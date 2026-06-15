import type { Env } from '../types'
import { checkRateLimit } from '../rate-limit'
import { hasSupabaseServiceRole } from '../supabase'
import { publishArticleToFacebook, resolveFbPageForCategory, type FbPageOverride } from './fb'
import { isWithinPostingHours } from './time-utils'
import { findLatestUnpostedArticle, findUnpostedArticleForCategory, recordPublication } from './social-db'

export type FbCategoryResult = {
  categorySlug: string
  pageId: string
  ran: boolean
  articleSlug?: string
  posted?: boolean
  providerPostId?: string
  postUrl?: string
  error?: string
  errorCode?: string
  skippedReason?: string
}

export type FbAutopostResult = {
  ran: boolean
  articleSlug?: string
  posted?: boolean
  providerPostId?: string
  postUrl?: string
  error?: string
  errorCode?: string
  skippedReason?: string
  /** Populated when FB_PAGES_BY_CATEGORY is configured (multi-page mode). */
  categoryResults?: FbCategoryResult[]
}

const DEFAULT_MAX_DAILY = 3

function fbConfigReady(env: Env): boolean {
  return Boolean((env.FB_PAGE_ID && env.FB_PAGE_ACCESS_TOKEN) || env.FB_PAGES_BY_CATEGORY)
}

/**
 * Parse FB_PAGES_BY_CATEGORY into a map of categorySlug → FbPageOverride.
 * Returns null if the env var is absent/empty or malformed.
 */
function parseCategoryPageMap(env: Env): Map<string, FbPageOverride> | null {
  const raw = String(env.FB_PAGES_BY_CATEGORY || '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, { id?: string; token?: string }>
    const map = new Map<string, FbPageOverride>()
    for (const [slug, entry] of Object.entries(parsed)) {
      if (entry?.id && entry?.token) map.set(slug, { id: entry.id, token: entry.token })
    }
    return map.size > 0 ? map : null
  } catch {
    console.warn('[fb] FB_PAGES_BY_CATEGORY is not valid JSON — falling back to single-page mode')
    return null
  }
}

/**
 * Process one category in multi-page mode.
 */
async function processCategoryAutopost(
  env: Env,
  now: Date,
  categorySlug: string,
  pageOverride: FbPageOverride,
  dailyLimit: number,
): Promise<FbCategoryResult> {
  const dayKey = now.toISOString().slice(0, 10)
  const hourKey = now.toISOString().slice(0, 13)

  const dayBucket = `fb:autopost:${pageOverride.id}:daily:${dayKey}`
  const dayLimitResult = await checkRateLimit(env, dayBucket, dailyLimit, 24 * 60 * 60)
  if (!dayLimitResult.allowed) {
    console.log(`[fb] category=${categorySlug} page=${pageOverride.id} skip=daily_limit_reached`)
    return { categorySlug, pageId: pageOverride.id, ran: false, skippedReason: 'daily_limit_reached' }
  }

  const hourBucket = `fb:autopost:${pageOverride.id}:hourly:${hourKey}`
  const hourLimitResult = await checkRateLimit(env, hourBucket, 1, 60 * 60)
  if (!hourLimitResult.allowed) {
    console.log(`[fb] category=${categorySlug} page=${pageOverride.id} skip=hourly_limit_reached`)
    return { categorySlug, pageId: pageOverride.id, ran: false, skippedReason: 'hourly_limit_reached' }
  }

  const article = await findUnpostedArticleForCategory(env, 'fb', categorySlug)
  if (!article) {
    console.log(`[fb] category=${categorySlug} page=${pageOverride.id} skip=no_unposted_articles`)
    return { categorySlug, pageId: pageOverride.id, ran: false, skippedReason: 'no_unposted_articles' }
  }

  const result = await publishArticleToFacebook(env, article.article_slug, {
    dryRun: false,
    requirePhoto: true,
    allowLinkFallback: true,
    pageOverride,
  })

  await recordPublication(env, 'fb', now, article.article_slug, result.ok, result)

  if (!result.ok) {
    console.log(`[fb] category=${categorySlug} page=${pageOverride.id} article=${article.article_slug} error=${result.error}`)
    return {
      categorySlug,
      pageId: pageOverride.id,
      ran: true,
      articleSlug: article.article_slug,
      posted: false,
      error: result.error,
      errorCode: result.errorCode,
    }
  }

  console.log(`[fb] category=${categorySlug} page=${pageOverride.id} article=${article.article_slug} posted postId=${result.providerPostId}`)
  return {
    categorySlug,
    pageId: pageOverride.id,
    ran: true,
    articleSlug: article.article_slug,
    posted: true,
    providerPostId: result.providerPostId,
    postUrl: result.postUrl,
  }
}

export async function processFbAutopost(env: Env, now = new Date()): Promise<FbAutopostResult> {
  if (!hasSupabaseServiceRole(env)) {
    return { ran: false, skippedReason: 'supabase_service_role_not_configured' }
  }

  if (!fbConfigReady(env)) {
    return { ran: false, skippedReason: 'fb_not_configured' }
  }

  if (!isWithinPostingHours(now)) {
    return { ran: false, skippedReason: 'outside_posting_hours' }
  }

  const dailyLimit = Math.max(1, Math.min(Number(env.FB_AUTOPOST_MAX_DAILY || DEFAULT_MAX_DAILY), 24))

  // ── Multi-page mode ──────────────────────────────────────────────────────
  const categoryPageMap = parseCategoryPageMap(env)
  if (categoryPageMap !== null) {
    const categoryResults: FbCategoryResult[] = []

    for (const [categorySlug, pageOverride] of categoryPageMap.entries()) {
      const catResult = await processCategoryAutopost(env, now, categorySlug, pageOverride, dailyLimit)
      categoryResults.push(catResult)
    }

    const anyRan = categoryResults.some((r) => r.ran)
    const firstSuccess = categoryResults.find((r) => r.posted)

    return {
      ran: anyRan,
      posted: firstSuccess ? true : undefined,
      articleSlug: firstSuccess?.articleSlug,
      providerPostId: firstSuccess?.providerPostId,
      postUrl: firstSuccess?.postUrl,
      categoryResults,
    }
  }

  // ── Single-page fallback (no FB_PAGES_BY_CATEGORY) ──────────────────────
  const dayBucket = `fb:autopost:daily:${now.toISOString().slice(0, 10)}`
  const dayLimit = await checkRateLimit(env, dayBucket, dailyLimit, 24 * 60 * 60)
  if (!dayLimit.allowed) {
    return { ran: false, skippedReason: 'daily_limit_reached' }
  }

  const hourBucket = `fb:autopost:hourly:${now.toISOString().slice(0, 13)}`
  const hourLimit = await checkRateLimit(env, hourBucket, 1, 60 * 60)
  if (!hourLimit.allowed) {
    return { ran: false, skippedReason: 'hourly_limit_reached' }
  }

  const article = await findLatestUnpostedArticle(env, 'fb')
  if (!article) {
    return { ran: false, skippedReason: 'no_unposted_articles' }
  }

  const pageOverride = resolveFbPageForCategory(env, article.category_slug)
  const result = await publishArticleToFacebook(env, article.article_slug, { dryRun: false, requirePhoto: true, allowLinkFallback: true, pageOverride })

  await recordPublication(env, 'fb', now, article.article_slug, result.ok, result)

  if (!result.ok) {
    return {
      ran: true,
      articleSlug: article.article_slug,
      posted: false,
      error: result.error,
      errorCode: result.errorCode,
    }
  }

  return {
    ran: true,
    articleSlug: article.article_slug,
    posted: true,
    providerPostId: result.providerPostId,
    postUrl: result.postUrl,
  }
}
