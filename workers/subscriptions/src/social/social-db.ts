/**
 * Shared DB query helpers for VK and Facebook autopost modules.
 * All functions are parameterized by `platform` ('vk' | 'fb'); the emitted
 * PostgREST query is identical to what each module had before — only the
 * platform filter value changes.
 */

import type { Env } from '../types'
import { insertRows, selectRows, updateRows } from '../supabase'
import type { ArticleRow } from './types'

export type SocialPlatform = 'vk' | 'fb'

/**
 * Freshness window (days) for the per-category selector. Articles published
 * within this window are posted BEFORE the older legacy backlog so freshly
 * publish-dynamic articles don't wait days behind the oldest-first queue
 * (#da8). Const, not env, on purpose — keeps the MVP config-free.
 */
const FRESH_WINDOW_DAYS = 7

/**
 * Slugs already posted to `platform` (status='posted'). One query; used to
 * exclude already-posted articles from candidate selection. Generous limit so
 * the set is complete (posting grows slowly — 1/category/hour).
 */
async function fetchPostedSlugSet(env: Env, platform: SocialPlatform): Promise<Set<string>> {
  const posted = await selectRows<{ article_slug: string }>(
    env,
    'social_publications',
    [`platform=eq.${platform}`, 'status=eq.posted', 'select=article_slug', 'limit=100000'].join('&'),
  )
  return new Set(posted.map((p) => p.article_slug))
}

/**
 * Page through articles_publication_index (ordered by published_at) and return
 * the FIRST row whose slug is not already posted.
 *
 * Why pagination instead of a small `LIMIT N` + in-memory filter (#e11): with a
 * fixed LIMIT, once a category's N oldest rows were all posted the window was
 * exhausted and EVERY newer unposted row — including dynamically-indexed
 * articles — was stranded forever (the selector returned null = "no unposted"
 * even though plenty of newer unposted rows existed). Paging until the first
 * unposted row is found removes that ceiling while keeping each query bounded.
 *
 * Candidacy is presence in the index alone — the poster (resolveArticleRecord)
 * sources body+image from the static index OR content_matrix, so dynamically-
 * published articles (absent from the static index) must NOT be filtered here.
 */
async function findFirstUnpostedArticle(
  env: Env,
  postedSlugs: Set<string>,
  order: 'asc' | 'desc',
  categorySlug?: string,
  minPublishedAt?: string,
): Promise<ArticleRow | null> {
  const PAGE = 500
  for (let offset = 0; ; offset += PAGE) {
    const filters = ['published_at=not.is.null']
    if (categorySlug) filters.push(`category_slug=eq.${encodeURIComponent(categorySlug)}`)
    if (minPublishedAt) filters.push(`published_at=gte.${encodeURIComponent(minPublishedAt)}`)
    filters.push(
      'select=article_slug,category_slug,title,canonical_path,description,published_at,first_seen_at',
      `order=published_at.${order}`,
      `limit=${PAGE}`,
      `offset=${offset}`,
    )
    const page = await selectRows<ArticleRow>(env, 'articles_publication_index', filters.join('&'))
    for (const article of page) {
      if (!postedSlugs.has(article.article_slug)) return article
    }
    if (page.length < PAGE) return null // last page reached, nothing unposted
  }
}

/**
 * Find the most-recently-published article that has NOT been posted to `platform`.
 * Returns null only when every indexed article is already posted.
 */
export async function findLatestUnpostedArticle(env: Env, platform: SocialPlatform): Promise<ArticleRow | null> {
  const postedSlugs = await fetchPostedSlugSet(env, platform)
  return findFirstUnpostedArticle(env, postedSlugs, 'desc')
}

/**
 * Pick the next unposted article for a specific category on `platform`.
 *
 * Freshness-first (#da8): first try the NEWEST unposted article published within
 * the last FRESH_WINDOW_DAYS, so a freshly publish-dynamic article posts promptly
 * instead of waiting behind the oldest-first legacy backlog. When nothing recent
 * is pending, fall back to the OLDEST unposted article — identical to the prior
 * behaviour, so the legacy backlog keeps draining (and the #e11 paging guarantee
 * is preserved).
 */
export async function findUnpostedArticleForCategory(env: Env, platform: SocialPlatform, categorySlug: string): Promise<ArticleRow | null> {
  const postedSlugs = await fetchPostedSlugSet(env, platform)
  const cutoff = new Date(Date.now() - FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const fresh = await findFirstUnpostedArticle(env, postedSlugs, 'desc', categorySlug, cutoff)
  if (fresh) return fresh
  return findFirstUnpostedArticle(env, postedSlugs, 'asc', categorySlug)
}

type PublicationResult = {
  bodyHash?: string
  providerPostId?: string
  postUrl?: string
  messageLength?: number
  publishMode?: string
  error?: string
  errorCode?: string
}

/**
 * Write the autopost outcome to social_publications.
 * Handles insert-on-success, insert-on-failure, and duplicate-key retry.
 */
export async function recordPublication(
  env: Env,
  platform: SocialPlatform,
  now: Date,
  articleSlug: string,
  ok: boolean,
  result: PublicationResult,
): Promise<void> {
  if (!ok) {
    try {
      await insertRows(env, 'social_publications', {
        platform,
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
      platform,
      article_slug: articleSlug,
      body_hash: result.bodyHash,
      status: 'posted',
      provider_post_id: result.providerPostId,
      provider_payload: { postUrl: result.postUrl, messageLength: result.messageLength, publishMode: result.publishMode, source: 'autopost' },
      posted_at: now.toISOString(),
    }, 'id')
  } catch (err) {
    // If insert fails due to race/duplicate, try to update existing
    if (String(err).includes('23505') || String(err).includes('duplicate')) {
      const existing = await selectRows<{ id: string }>(
        env,
        'social_publications',
        `platform=eq.${platform}&article_slug=eq.${encodeURIComponent(articleSlug)}&select=id&limit=1`,
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
