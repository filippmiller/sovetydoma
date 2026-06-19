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

// --- #da8 freshness-first selection ----------------------------------------
// The naive installFetch above ignores order/filter params; the freshness tests
// need a fetch mock that actually honours the PostgREST query (category eq,
// published_at gte, order asc/desc, offset/limit) so the two-pass selection
// (fresh desc within 7d -> fallback oldest asc) is exercised for real.

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (n: number): string => new Date(Date.now() - n * DAY_MS).toISOString()
const hoursAgo = (n: number): string => new Date(Date.now() - n * 60 * 60 * 1000).toISOString()

function art(slug: string, published: string, category = 'kulinaria'): ArticleRow {
  return {
    article_slug: slug,
    category_slug: category,
    title: slug,
    canonical_path: `/${category}/${slug}/`,
    description: 'd',
    published_at: published,
    first_seen_at: published,
  }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
}

// PostgREST-aware mock: filters by category_slug=eq, published_at=gte, orders by
// published_at asc/desc and applies offset/limit, mirroring the real endpoint.
function installSmartFetch(allRows: ArticleRow[], postedSlugs: string[]): () => void {
  const orig = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname.includes('social_publications')) {
      return jsonResponse(postedSlugs.map((s) => ({ article_slug: s })))
    }
    if (url.pathname.includes('articles_publication_index')) {
      const p = url.searchParams
      const cat = (p.get('category_slug') || '').replace(/^eq\./, '')
      const gte = p.getAll('published_at').find((v) => v.startsWith('gte.'))?.slice(4)
      const desc = (p.get('order') || 'published_at.asc').endsWith('desc')
      const offset = Number(p.get('offset') || '0')
      const limit = Number(p.get('limit') || '1000')
      const rows = allRows
        .filter((r) => (!cat || r.category_slug === cat) && (!gte || r.published_at >= gte))
        .sort((a, b) => (desc ? b.published_at.localeCompare(a.published_at) : a.published_at.localeCompare(b.published_at)))
        .slice(offset, offset + limit)
      return jsonResponse(rows)
    }
    return jsonResponse([])
  }) as typeof fetch
  return () => { globalThis.fetch = orig }
}

test('#da8 freshness-first: fresh unposted (<=7d) wins over old unposted', async () => {
  const rows = [art('legacy-old', daysAgo(60)), art('fresh-new', daysAgo(1))]
  const restore = installSmartFetch(rows, [])
  try {
    const r = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
    assert.equal(r?.article_slug, 'fresh-new')
  } finally { restore() }
})

test('#da8 freshness-first: no fresh -> oldest-first fallback (legacy drains)', async () => {
  const rows = [art('old-c', daysAgo(10)), art('old-a', daysAgo(30)), art('old-b', daysAgo(20))]
  const restore = installSmartFetch(rows, [])
  try {
    const r = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
    assert.equal(r?.article_slug, 'old-a', 'oldest (30d) when nothing is within the freshness window')
  } finally { restore() }
})

test('#da8 freshness-first: fresh already posted -> skipped, next fresh unposted chosen', async () => {
  const rows = [art('fresh-newest', daysAgo(1)), art('fresh-older', daysAgo(3)), art('legacy', daysAgo(40))]
  const restore = installSmartFetch(rows, ['fresh-newest'])
  try {
    const r = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
    assert.equal(r?.article_slug, 'fresh-older')
  } finally { restore() }
})

test('#da8 freshness-first: all fresh posted -> fallback drains oldest legacy', async () => {
  const rows = [art('fresh', daysAgo(2)), art('legacy-oldest', daysAgo(50)), art('legacy-mid', daysAgo(40))]
  const restore = installSmartFetch(rows, ['fresh'])
  try {
    const r = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
    assert.equal(r?.article_slug, 'legacy-oldest')
  } finally { restore() }
})

test('#da8/#e11: 20 oldest posted + 21st unposted (all legacy) -> returns 21st via fallback', async () => {
  // 21 legacy articles all older than the freshness window (30..50d), oldest = art-000.
  const rows = Array.from({ length: 21 }, (_, i) => art(`art-${String(i).padStart(3, '0')}`, daysAgo(50 - i)))
  const posted = rows
    .slice()
    .sort((a, b) => a.published_at.localeCompare(b.published_at))
    .slice(0, 20)
    .map((r) => r.article_slug) // 20 oldest posted
  const restore = installSmartFetch(rows, posted)
  try {
    const r = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
    assert.ok(r, 'must page past the posted prefix even with no fresh article (#e11)')
    assert.equal(r?.article_slug, 'art-020', 'the single unposted legacy row')
  } finally { restore() }
})

test('#da8 freshness-first: cutoff boundary (just inside 7d picked; just outside falls to oldest-first)', async () => {
  const legacy = art('legacy', daysAgo(40))
  {
    const inside = art('boundary', hoursAgo(7 * 24 - 1)) // ~6d23h ago -> inside window
    const restore = installSmartFetch([legacy, inside], [])
    try {
      const r = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
      assert.equal(r?.article_slug, 'boundary', 'within window -> fresh path')
    } finally { restore() }
  }
  {
    const outside = art('boundary', hoursAgo(7 * 24 + 1)) // ~7d1h ago -> outside window
    const restore = installSmartFetch([legacy, outside], [])
    try {
      const r = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
      assert.equal(r?.article_slug, 'legacy', 'outside window -> oldest-first fallback (40d legacy)')
    } finally { restore() }
  }
})

test('#e11/#da8: fallback pages PAST the first PAGE=500 (unposted legacy beyond page boundary is found)', async () => {
  // 520 legacy rows (all older than the freshness window), oldest-first art-000..art-519.
  // Everything is posted EXCEPT one row at asc-index 510 — beyond the first 500-row
  // page. The fresh (desc/<=7d) scan returns nothing, so the oldest-first fallback
  // must page to offset=500 to find it; a single-page selector would miss it.
  const N = 520
  const rows = Array.from({ length: N }, (_, i) => art(`art-${String(i).padStart(3, '0')}`, daysAgo(600 - i)))
  const target = 'art-510'
  const posted = rows.map((r) => r.article_slug).filter((s) => s !== target)
  const restore = installSmartFetch(rows, posted)
  try {
    const r = await findUnpostedArticleForCategory(env, 'vk', 'kulinaria')
    assert.ok(r, 'must page past the first 500-row page to find the lone unposted legacy row')
    assert.equal(r?.article_slug, target, 'returns the unposted row located beyond PAGE=500')
  } finally { restore() }
})
