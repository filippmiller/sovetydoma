import type { Env } from '../types'
import { checkRateLimit } from '../rate-limit'
import { hasSupabaseServiceRole, insertRows, selectRows, updateRows } from '../supabase'
import { findArticleRecord } from './vk'
import { publishArticleToFacebook, resolveFbPageForCategory } from './fb'

export type FbAutopostResult = {
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

function fbConfigReady(env: Env): boolean {
  // Ready if a default page is set, or per-category pages are configured.
  return Boolean((env.FB_PAGE_ID && env.FB_PAGE_ACCESS_TOKEN) || env.FB_PAGES_BY_CATEGORY)
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
      "platform=eq.fb",
      "status=eq.posted",
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

  // Route to the Page for this article's category when multi-page is configured;
  // otherwise the default FB_PAGE_ID/TOKEN is used.
  const pageOverride = resolveFbPageForCategory(env, article.category_slug)
  const result = await publishArticleToFacebook(env, article.article_slug, { dryRun: false, requirePhoto: true, allowLinkFallback: true, pageOverride })

  if (!result.ok) {
    try {
      await insertRows(env, 'social_publications', {
        platform: 'fb',
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

  try {
    await insertRows(env, 'social_publications', {
      platform: 'fb',
      article_slug: article.article_slug,
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
        `platform=eq.fb&article_slug=eq.${encodeURIComponent(article.article_slug)}&select=id&limit=1`,
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

  return {
    ran: true,
    articleSlug: article.article_slug,
    posted: true,
    providerPostId: result.providerPostId,
    postUrl: result.postUrl,
  }
}
