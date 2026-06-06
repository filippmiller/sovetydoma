import type { Env } from '../types'
import { checkRateLimit } from '../rate-limit'
import { hasSupabaseServiceRole, insertRows, selectRows, updateRows } from '../supabase'
import { findArticleRecord, publishArticleToVk } from './vk'

export type VkAutopostResult = {
  ran: boolean
  articleSlug?: string
  posted?: boolean
  providerPostId?: string
  postUrl?: string
  error?: string
  errorCode?: string
  skippedReason?: string
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
    return now.getUTCHours() + 3 // rough Moscow fallback
  }
}

function isWithinPostingHours(now: Date): boolean {
  const hour = getMoscowHour(now)
  return hour >= MOSCOW_DAY_START && hour < MOSCOW_DAY_END
}

function vkConfigReady(env: Env): boolean {
  return Boolean(env.VK_ACCESS_TOKEN && env.VK_GROUP_ID && env.VK_PHOTO_ACCESS_TOKEN)
}

async function findLatestUnpostedArticle(env: Env): Promise<ArticleRow | null> {
  // Fetch the most recent published articles (up to 20) — we scan backwards
  // to skip any that might not be in the local VK publication index yet.
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

  // Fetch already-posted VK slugs
  const posted = await selectRows<{ article_slug: string }>(
    env,
    'social_publications',
    [
      "platform=eq.vk",
      "status=eq.posted",
      'select=article_slug',
      'limit=1000',
    ].join('&'),
  )
  const postedSlugs = new Set(posted.map((p) => p.article_slug))

  // Return the first recent article that is not yet posted and exists in the local index
  for (const article of recentArticles) {
    if (postedSlugs.has(article.article_slug)) continue
    if (!findArticleRecord(article.article_slug)) continue
    return article
  }

  return null
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

  // Daily cap
  const dailyLimit = Math.max(1, Math.min(Number(env.VK_AUTOPOST_MAX_DAILY || DEFAULT_MAX_DAILY), 24))
  const dayBucket = `vk:autopost:daily:${now.toISOString().slice(0, 10)}`
  const dayLimit = await checkRateLimit(env, dayBucket, dailyLimit, 24 * 60 * 60)
  if (!dayLimit.allowed) {
    return { ran: false, skippedReason: 'daily_limit_reached' }
  }

  // Hourly cap (1 per hour)
  const hourBucket = `vk:autopost:hourly:${now.toISOString().slice(0, 13)}`
  const hourLimit = await checkRateLimit(env, hourBucket, 1, 60 * 60)
  if (!hourLimit.allowed) {
    return { ran: false, skippedReason: 'hourly_limit_reached' }
  }

  const article = await findLatestUnpostedArticle(env)
  if (!article) {
    return { ran: false, skippedReason: 'no_unposted_articles' }
  }

  const result = await publishArticleToVk(env, article.article_slug, { dryRun: false, requirePhoto: true })

  if (!result.ok) {
    // Record failure
    try {
      await insertRows(env, 'social_publications', {
        platform: 'vk',
        article_slug: article.article_slug,
        body_hash: result.bodyHash || '',
        status: 'failed',
        provider_payload: { error: result.error, errorCode: result.errorCode, source: 'autopost' },
        error_code: result.errorCode || 'unknown',
        error_message: result.error || 'unknown',
      }, 'id')
    } catch {
      // Ignore DB write failure
    }
    return {
      ran: true,
      articleSlug: article.article_slug,
      posted: false,
      error: result.error,
      errorCode: result.errorCode,
    }
  }

  // Record success
  try {
    await insertRows(env, 'social_publications', {
      platform: 'vk',
      article_slug: article.article_slug,
      body_hash: result.bodyHash,
      status: 'posted',
      provider_post_id: result.providerPostId,
      provider_payload: { postUrl: result.postUrl, messageLength: result.messageLength, source: 'autopost' },
      posted_at: now.toISOString(),
    }, 'id')
  } catch (err) {
    // If insert fails due to race/duplicate, try to update existing
    if (String(err).includes('23505') || String(err).includes('duplicate')) {
      const existing = await selectRows<{ id: string }>(
        env,
        'social_publications',
        `platform=eq.vk&article_slug=eq.${encodeURIComponent(article.article_slug)}&select=id&limit=1`,
      )
      if (existing[0]) {
        await updateRows(env, 'social_publications', `id=eq.${encodeURIComponent(existing[0].id)}`, {
          status: 'posted',
          provider_post_id: result.providerPostId,
          provider_payload: { postUrl: result.postUrl, messageLength: result.messageLength, source: 'autopost' },
          posted_at: now.toISOString(),
          error_code: null,
          error_message: null,
        }, 'id')
      }
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
