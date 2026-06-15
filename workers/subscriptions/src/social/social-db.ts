/**
 * Shared DB query helpers for VK and Facebook autopost modules.
 * All functions are parameterized by `platform` ('vk' | 'fb'); the emitted
 * PostgREST query is identical to what each module had before — only the
 * platform filter value changes.
 */

import type { Env } from '../types'
import { insertRows, selectRows, updateRows } from '../supabase'
import { findArticleRecord } from './vk'
import type { ArticleRow } from './types'

export type SocialPlatform = 'vk' | 'fb'

/**
 * Find the most-recently-published article that has NOT been posted to `platform`.
 * Returns null if everything recent is already posted.
 */
export async function findLatestUnpostedArticle(env: Env, platform: SocialPlatform): Promise<ArticleRow | null> {
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
      `platform=eq.${platform}`,
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

/**
 * Find the oldest unposted article for a specific category on `platform`.
 * Filters by category_slug and excludes articles already posted.
 */
export async function findUnpostedArticleForCategory(env: Env, platform: SocialPlatform, categorySlug: string): Promise<ArticleRow | null> {
  const recentArticles = await selectRows<ArticleRow>(
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

  if (recentArticles.length === 0) return null

  const posted = await selectRows<{ article_slug: string }>(
    env,
    'social_publications',
    [
      `platform=eq.${platform}`,
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
