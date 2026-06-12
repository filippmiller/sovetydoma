import type { Env } from '../types'
import { checkRateLimit } from '../rate-limit'
import { hasSupabaseServiceRole, insertRows, selectRows, updateRows } from '../supabase'
import { findArticleRecord } from './vk'
import { publishArticleToFacebook, resolveFbPageForCategory, type FbPageOverride } from './fb'

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

type ArticleRow = {
  article_slug: string
  category_slug: string
  title: string
  canonical_path: string
  description: string
  published_at: string | null
  first_seen_at: string
}

const MOSCOW_DAY_START = 9
const MOSCOW_DAY_END = 21
const DEFAULT_MAX_DAILY = 3

function getMoscowHour(now: Date): number {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now).find((part) => part.type === 'hour')?.value
    return Number(hour)
  } catch {
    return now.getUTCHours() + 3
  }
}

function isWithinPostingHours(now: Date): boolean {
  const hour = getMoscowHour(now)
  return hour >= MOSCOW_DAY_START && hour < MOSCOW_DAY_END
}

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

async function findLatestUnpostedArticle(env: Env): Promise<ArticleRow | null> {
  const recentArticles = await selectRows<ArticleRow>(
    env,
    'articles_publication_index',
    [
      'published_at=not.is.null',
      'select=article_slug,category_slug,title,canonical_path,description,published_at,first_seen_at',
      'order=published_at.desc',
      'limit=20',
    ].join('&'),
  )

  if (recentArticles.length === 0) return null

  const posted = await selectRows<{ article_slug: string }>(
    env,
    'social_publications',
    [
      'platform=eq.fb',
      'status=eq.posted',
      'select=article_slug',
      'limit=1000',
    ].join('&'),
  )
  const postedSlugs = new Set(posted.map((p) => p.article_slug))

  for (const article of recentArticles) {
    if (postedSlugs.has(article.article_slug)) continue
    if (!findArticleRecord(article.article_slug)) continue
    return article
  }

  return null
}

async function findUnpostedArticleForCategory(env: Env, categorySlug: string): Promise<ArticleRow | null> {
  const articles = await selectRows<ArticleRow>(
    env,
    'articles_publication_index',
    [
      'published_at=not.is.null',
      `category_slug=eq.${encodeURIComponent(categorySlug)}`,
      'select=article_slug,category_slug,title,canonical_path,description,published_at,first_seen_at',
      'order=published_at.asc',
      'limit=20',
    ].join('&'),
  )

  if (articles.length === 0) return null

  const posted = await selectRows<{ article_slug: string }>(
    env,
    'social_publications',
    [
      'platform=eq.fb',
      'status=eq.posted',
      'select=article_slug',
      'limit=1000',
    ].join('&'),
  )
  const postedSlugs = new Set(posted.map((p) => p.article_slug))

  for (const article of articles) {
    if (postedSlugs.has(article.article_slug)) continue
    if (!findArticleRecord(article.article_slug)) continue
    return article
  }

  return null
}

async function recordPublication(
  env: Env,
  now: Date,
  articleSlug: string,
  ok: boolean,
  result: { bodyHash?: string; providerPostId?: string; postUrl?: string; messageLength?: number; publishMode?: string; error?: string; errorCode?: string },
): Promise<void> {
  if (!ok) {
    try {
      await insertRows(env, 'social_publications', {
        platform: 'fb',
        article_slug: articleSlug,
        body_hash: result.bodyHash || '',
        status: 'failed',
        provider_payload: { error: result.error, errorCode: result.errorCode, source: 'autopost' },
        error_code: result.errorCode || 'unknown',
        error_message: result.error || 'unknown',
      }, 'id')
    } catch {
      // Ignore DB write failure
    }
    return
  }

  try {
    await insertRows(env, 'social_publications', {
      platform: 'fb',
      article_slug: articleSlug,
      body_hash: result.bodyHash,
      status: 'posted',
      provider_post_id: result.providerPostId,
      provider_payload: { postUrl: result.postUrl, messageLength: result.messageLength, publishMode: result.publishMode, source: 'autopost' },
      posted_at: now.toISOString(),
    }, 'id')
  } catch (err) {
    if (String(err).includes('23505') || String(err).includes('duplicate')) {
      const existing = await selectRows<{ id: string }>(
        env,
        'social_publications',
        `platform=eq.fb&article_slug=eq.${encodeURIComponent(articleSlug)}&select=id&limit=1`,
      )
      if (existing[0]) {
        await updateRows(env, 'social_publications', `id=eq.${encodeURIComponent(existing[0].id)}`, {
          status: 'posted',
          provider_post_id: result.providerPostId,
          provider_payload: { postUrl: result.postUrl, messageLength: result.messageLength, publishMode: result.publishMode, source: 'autopost' },
          posted_at: now.toISOString(),
          error_code: null,
          error_message: null,
        }, 'id')
      }
    }
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

  const article = await findUnpostedArticleForCategory(env, categorySlug)
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

  await recordPublication(env, now, article.article_slug, result.ok, result)

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

  const article = await findLatestUnpostedArticle(env)
  if (!article) {
    return { ran: false, skippedReason: 'no_unposted_articles' }
  }

  const pageOverride = resolveFbPageForCategory(env, article.category_slug)
  const result = await publishArticleToFacebook(env, article.article_slug, { dryRun: false, requirePhoto: true, allowLinkFallback: true, pageOverride })

  await recordPublication(env, now, article.article_slug, result.ok, result)

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
