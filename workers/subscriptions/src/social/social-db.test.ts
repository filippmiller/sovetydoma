import assert from 'node:assert/strict'
import test from 'node:test'
import { findUnpostedArticleForCategory, findLatestUnpostedArticle } from './social-db'
import type { Env } from '../types'
import type { ArticleRow } from './types'

const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
} as Env

// Ascending published_at (oldest first), slugs art-000..art-(n-1).
function mkArticles(n: number, category = 'kulinaria'): ArticleRow[] {
  return Array.from({ length: n }, (_, i) => ({
    article_slug: `art-${String(i).padStart(3, '0')}`,
    category_slug: category,
    title: `T${i}`,
    canonical_path: `/${category}/art-${String(i).padStart(3, '0')}/`,
    description: 'd',
    published_at: `2026-05-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    first_seen_at: `2026-05-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
  }))
}

function installFetch(indexRows: ArticleRow[], postedSlugs: string[]): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('social_publications')) {
      return new Response(JSON.stringify(postedSlugs.map((s) => ({ article_slug: s }))), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }
    if (url.includes('articles_publication_index')) {
      return new Response(JSON.stringify(indexRows), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  return () => { globalThis.fetch = orig }
}

// #e11 acceptance: with the old LIMIT-20-then-filter the selector returned null
// here (all 20 fetched were posted). The fix must page past the posted prefix.
test('findUnpostedArticleForCategory: first 20 oldest posted, 21st unposted -> returns 21st (not null)', async () => {
  const rows = mkArticles(21)                                   // art-000 .. art-020, asc
  const posted = rows.slice(0, 20).map((r) => r.article_slug)  // 20 oldest already posted
  const restore = installFetch(rows, posted)
  try {
    const result = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
    assert.ok(result, 'should NOT be null when a newer unposted row exists beyond the first 20')
    assert.equal(result?.article_slug, 'art-020', 'returns the oldest unposted (the 21st)')
  } finally { restore() }
})

test('findUnpostedArticleForCategory: every indexed article posted -> null', async () => {
  const rows = mkArticles(5)
  const restore = installFetch(rows, rows.map((r) => r.article_slug))
  try {
    assert.equal(await findUnpostedArticleForCategory(env, 'vk', 'kulinaria'), null)
  } finally { restore() }
})

test('findLatestUnpostedArticle: newest already posted -> returns next-newest unposted', async () => {
  const rows = mkArticles(3).reverse()        // newest first (mirrors order=desc)
  const posted = [rows[0].article_slug]       // newest is posted
  const restore = installFetch(rows, posted)
  try {
    const result = await findLatestUnpostedArticle(env, 'fb')
    assert.ok(result)
    assert.equal(result?.article_slug, rows[1].article_slug)
  } finally { restore() }
})
