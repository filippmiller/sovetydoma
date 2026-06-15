import type { Env } from '../types'
import { checkRateLimit } from '../rate-limit'
import { hasSupabaseServiceRole } from '../supabase'
import { publishArticleToVk, resolveVkGroupForCategory } from './vk'
import { isWithinPostingHours } from './time-utils'
import { findLatestUnpostedArticle, findUnpostedArticleForCategory, recordPublication } from './social-db'

export type VkCategoryResult = {
  categorySlug: string
  groupId: string
  ran: boolean
  articleSlug?: string
  posted?: boolean
  providerPostId?: string
  postUrl?: string
  error?: string
  errorCode?: string
  skippedReason?: string
}

export type VkAutopostResult = {
  ran: boolean
  articleSlug?: string
  posted?: boolean
  providerPostId?: string
  postUrl?: string
  error?: string
  errorCode?: string
  skippedReason?: string
  /** Populated when VK_GROUPS_BY_CATEGORY is configured (multi-group mode). */
  categoryResults?: VkCategoryResult[]
}

const DEFAULT_MAX_DAILY = 3

function vkConfigReady(env: Env): boolean {
  return Boolean(env.VK_ACCESS_TOKEN && env.VK_GROUP_ID)
}

/**
 * Parse VK_GROUPS_BY_CATEGORY into a map of categorySlug → groupId.
 * Returns null if the env var is absent/empty or malformed.
 */
function parseCategoryGroupMap(env: Env): Map<string, string> | null {
  const raw = String(env.VK_GROUPS_BY_CATEGORY || '').trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, { groupId?: string }>
    const map = new Map<string, string>()
    for (const [slug, entry] of Object.entries(parsed)) {
      if (entry?.groupId) map.set(slug, entry.groupId)
    }
    return map.size > 0 ? map : null
  } catch {
    console.warn('[vk] VK_GROUPS_BY_CATEGORY is not valid JSON — falling back to single-group mode')
    return null
  }
}

/**
 * Process one category in multi-group mode.
 * Returns a VkCategoryResult describing what happened.
 */
async function processCategoryAutopost(
  env: Env,
  now: Date,
  categorySlug: string,
  groupId: string,
  dailyLimit: number,
): Promise<VkCategoryResult> {
  const dayKey = now.toISOString().slice(0, 10)
  const hourKey = now.toISOString().slice(0, 13)

  // Per-group daily cap
  const dayBucket = `vk:autopost:${groupId}:daily:${dayKey}`
  const dayLimit = await checkRateLimit(env, dayBucket, dailyLimit, 24 * 60 * 60)
  if (!dayLimit.allowed) {
    console.log(`[vk] category=${categorySlug} group=${groupId} skip=daily_limit_reached`)
    return { categorySlug, groupId, ran: false, skippedReason: 'daily_limit_reached' }
  }

  // Per-group hourly cap (1 per hour)
  const hourBucket = `vk:autopost:${groupId}:hourly:${hourKey}`
  const hourLimit = await checkRateLimit(env, hourBucket, 1, 60 * 60)
  if (!hourLimit.allowed) {
    console.log(`[vk] category=${categorySlug} group=${groupId} skip=hourly_limit_reached`)
    return { categorySlug, groupId, ran: false, skippedReason: 'hourly_limit_reached' }
  }

  const article = await findUnpostedArticleForCategory(env, 'vk', categorySlug)
  if (!article) {
    console.log(`[vk] category=${categorySlug} group=${groupId} skip=no_unposted_articles`)
    return { categorySlug, groupId, ran: false, skippedReason: 'no_unposted_articles' }
  }

  const publishResult = await publishArticleToVk(env, article.article_slug, {
    dryRun: false,
    requirePhoto: true,
    allowLinkFallback: true,
    groupOverride: { groupId },
  })

  await recordPublication(env, 'vk', now, article.article_slug, publishResult.ok, publishResult)

  if (!publishResult.ok) {
    console.log(`[vk] category=${categorySlug} group=${groupId} article=${article.article_slug} error=${publishResult.error}`)
    return {
      categorySlug,
      groupId,
      ran: true,
      articleSlug: article.article_slug,
      posted: false,
      error: publishResult.error,
      errorCode: publishResult.errorCode,
    }
  }

  console.log(`[vk] category=${categorySlug} group=${groupId} article=${article.article_slug} posted postId=${publishResult.providerPostId}`)
  return {
    categorySlug,
    groupId,
    ran: true,
    articleSlug: article.article_slug,
    posted: true,
    providerPostId: publishResult.providerPostId,
    postUrl: publishResult.postUrl,
  }
}

export async function processVkAutopost(env: Env, now = new Date()): Promise<VkAutopostResult> {
  if (!hasSupabaseServiceRole(env)) {
    return { ran: false, skippedReason: 'supabase_service_role_not_configured' }
  }

  if (!vkConfigReady(env)) {
    return { ran: false, skippedReason: 'vk_not_configured' }
  }

  if (!isWithinPostingHours(now)) {
    return { ran: false, skippedReason: 'outside_posting_hours' }
  }

  const dailyLimit = Math.max(1, Math.min(Number(env.VK_AUTOPOST_MAX_DAILY || DEFAULT_MAX_DAILY), 24))

  // ── Multi-group mode ─────────────────────────────────────────────────────
  const categoryGroupMap = parseCategoryGroupMap(env)
  if (categoryGroupMap !== null) {
    const categoryResults: VkCategoryResult[] = []

    for (const [categorySlug, groupId] of categoryGroupMap.entries()) {
      const catResult = await processCategoryAutopost(env, now, categorySlug, groupId, dailyLimit)
      categoryResults.push(catResult)
    }

    // Aggregate: ran=true if any ran, posted=true if any posted
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

  // ── Single-group fallback (no VK_GROUPS_BY_CATEGORY) ────────────────────
  const dayBucket = `vk:autopost:daily:${now.toISOString().slice(0, 10)}`
  const dayLimit = await checkRateLimit(env, dayBucket, dailyLimit, 24 * 60 * 60)
  if (!dayLimit.allowed) {
    return { ran: false, skippedReason: 'daily_limit_reached' }
  }

  const hourBucket = `vk:autopost:hourly:${now.toISOString().slice(0, 13)}`
  const hourLimit = await checkRateLimit(env, hourBucket, 1, 60 * 60)
  if (!hourLimit.allowed) {
    return { ran: false, skippedReason: 'hourly_limit_reached' }
  }

  const article = await findLatestUnpostedArticle(env, 'vk')
  if (!article) {
    return { ran: false, skippedReason: 'no_unposted_articles' }
  }

  // Route to the community for this article's category when multi-group is
  // configured; otherwise the default VK_GROUP_ID is used.
  const groupOverride = resolveVkGroupForCategory(env, article.category_slug)
  const result = await publishArticleToVk(env, article.article_slug, { dryRun: false, requirePhoto: true, allowLinkFallback: true, groupOverride })

  await recordPublication(env, 'vk', now, article.article_slug, result.ok, result)

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
