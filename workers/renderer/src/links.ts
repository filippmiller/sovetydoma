// NO-REDEPLOY publishing: this worker makes article publishing rebuild-free.
// See docs/NO-REDEPLOY-PUBLISHING.md

/**
 * Internal-linking module — pure functions (no Worker globals) so they can be
 * unit-tested with plain node/tsx.
 *
 * Two outputs:
 *  1. "Читайте также" related-links block injected into every dynamic article.
 *  2. Crawlable hub pages (/stati/…): paginated server-rendered listings of all
 *     dynamically-published articles per category. Together these eliminate
 *     orphan pages (SEO-farm risk) without rebuilding the static site.
 */

// ---------------------------------------------------------------------------
// Related articles selection
// ---------------------------------------------------------------------------

export interface RelatedCandidate {
  slug: string
  category: string
  title: string
  description: string | null
  tags: string[] | null
  image_filename: string | null
  published_at: string
  published_via: string | null
  /** Present when the DB query selects it; used as a defensive publish filter. */
  text_status?: string
}

/** Deterministic 32-bit FNV-1a hash — stable rotation seed per article. */
export function hashSlug(slug: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Pick `count` related articles for `current` from `candidates`.
 *
 * Contract:
 * - `candidates` MUST already be filtered to published, active rows of the
 *   current article's category (the DB query enforces this; see index.ts).
 * - The current article itself is excluded defensively (no self-links).
 * - Slugs are de-duplicated defensively.
 * - Ordering is deterministic: shared tags desc → published_at desc → slug asc,
 *   then the list is rotated by hash(current.slug) so that inbound links are
 *   spread across the whole category corpus instead of always pointing to the
 *   same newest N articles. Same input → same output (no randomness).
 * - If fewer than `count` candidates exist, all of them are returned.
 */
export function selectRelated(
  candidates: RelatedCandidate[],
  current: { slug: string; tags: string[] | null },
  count: number,
): RelatedCandidate[] {
  const currentTags = new Set((current.tags ?? []).map((t) => t.toLowerCase()))
  const seen = new Set<string>()
  const pool: Array<{ row: RelatedCandidate; shared: number }> = []

  for (const row of candidates) {
    if (row.slug === current.slug) continue // never link to the current article
    if (seen.has(row.slug)) continue // never emit duplicate links
    // Defensive: when the row carries its status, never link unpublished rows
    // (drafts, ideas, archived) even if the caller's query was wrong.
    if (row.text_status !== undefined && row.text_status !== 'published') continue
    if (!row.slug || !row.title) continue
    seen.add(row.slug)
    const shared = (row.tags ?? []).filter((t) => currentTags.has(t.toLowerCase())).length
    pool.push({ row, shared })
  }

  pool.sort((a, b) => {
    if (b.shared !== a.shared) return b.shared - a.shared
    if (b.row.published_at !== a.row.published_at) {
      return b.row.published_at < a.row.published_at ? -1 : 1
    }
    return a.row.slug < b.row.slug ? -1 : 1
  })

  if (pool.length <= count) return pool.map((p) => p.row)

  const rotation = hashSlug(current.slug) % pool.length
  const rotated = pool.slice(rotation).concat(pool.slice(0, rotation))
  return rotated.slice(0, count).map((p) => p.row)
}

// ---------------------------------------------------------------------------
// PostgREST pagination helper
// ---------------------------------------------------------------------------

export const POSTGREST_PAGE_SIZE = 1000

/**
 * Fetch ALL rows from a paginated source. PostgREST caps a single response
 * (commonly at 1,000 rows) even when a larger limit is requested, so callers
 * must page explicitly with limit/offset. Stops on a short page or when
 * `maxRows` is reached. `fetchPage(offset, limit)` performs one request.
 */
export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
  opts: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? POSTGREST_PAGE_SIZE
  const maxRows = opts.maxRows ?? 50_000
  const rows: T[] = []
  for (;;) {
    const page = await fetchPage(rows.length, pageSize)
    rows.push(...page)
    if (page.length < pageSize || rows.length >= maxRows) break
  }
  return rows
}

// ---------------------------------------------------------------------------
// HTML builders (inline styles — matches the template page aesthetic)
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const CARD_STYLE = 'background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:grid;grid-template-columns:minmax(0, 1fr) 62px;gap:0.6rem;min-height:82px;height:100%;padding:0.65rem;border:1px solid #2980b933'
const CARD_STYLE_NO_IMG = 'background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:block;min-height:82px;height:100%;padding:0.65rem;border:1px solid #2980b933'
const TITLE_STYLE = 'font-size:0.78rem;font-weight:700;color:#1a1a1a;line-height:1.35;margin:0 0 0.25rem;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical'
const DESC_STYLE = 'font-size:0.72rem;color:#777;line-height:1.4;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical'

function relatedCardHtml(row: RelatedCandidate): string {
  const href = `/${encodeURIComponent(row.category)}/${encodeURIComponent(row.slug)}/`
  const title = escapeHtml(row.title)
  // Preview images are guaranteed to exist only for dynamically-published
  // articles (uploaded to R2 as previews/<image_filename> by publish-dynamic).
  const hasPreview = row.published_via === 'dynamic' && !!row.image_filename
  const desc = row.description ? `<p style="${DESC_STYLE}">${escapeHtml(row.description)}</p>` : ''
  const img = hasPreview
    ? `<div style="position:relative;width:62px;height:62px;border-radius:8px;overflow:hidden;background:#f4f0ea;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.06)"><img src="/images/previews/${encodeURIComponent(row.image_filename as string)}" alt="${title}" loading="lazy" decoding="async" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"/></div>`
    : ''
  return `<a style="text-decoration:none;color:inherit" href="${href}"><article class="article-card" style="${hasPreview ? CARD_STYLE : CARD_STYLE_NO_IMG}"><div style="min-width:0"><p style="${TITLE_STYLE}">${title}</p>${desc}</div>${img}</article></a>`
}

/**
 * Inner HTML for <section class="related-articles">: a server-rendered
 * "Читайте также" grid plus a link to the category hub page. No JavaScript.
 */
export function buildRelatedHtml(
  related: RelatedCandidate[],
  opts: { category: string; categoryName: string },
): string {
  const cards = related.map(relatedCardHtml).join('')
  const hubHref = `/stati/${encodeURIComponent(opts.category)}/`
  return `<h2 style="font-size:0.9rem;font-weight:800;margin-bottom:0.65rem;color:#555;text-transform:uppercase;letter-spacing:0.05em">Читайте также</h2>`
    + `<div style="display:grid;grid-template-columns:1fr;gap:0.65rem">${cards}</div>`
    + `<p style="margin:0.9rem 0 0;font-size:0.85rem"><a style="color:#2980b9;text-decoration:none;font-weight:700" href="${hubHref}">Все материалы рубрики «${escapeHtml(opts.categoryName)}» →</a></p>`
}

// ---------------------------------------------------------------------------
// Hub pages
// ---------------------------------------------------------------------------

export const HUB_PAGE_SIZE = 40

export interface HubPage<T> {
  items: T[]
  page: number
  totalPages: number
  totalItems: number
}

/** 1-based pagination. Out-of-range pages are clamped; empty input → page 1 of 1. */
export function paginate<T>(items: T[], page: number, pageSize: number): HubPage<T> {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const clamped = Math.min(Math.max(1, page), totalPages)
  const start = (clamped - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page: clamped, totalPages, totalItems }
}

function hubHead(opts: { title: string; description: string; canonical: string }): string {
  return `<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}"/>
<link rel="canonical" href="${escapeHtml(opts.canonical)}"/>
<meta property="og:title" content="${escapeHtml(opts.title)}"/>
<meta property="og:description" content="${escapeHtml(opts.description)}"/>
<meta property="og:url" content="${escapeHtml(opts.canonical)}"/>
<meta property="og:type" content="website"/>
<style>
body{font-family:'PT Sans',system-ui,-apple-system,'Segoe UI',sans-serif;margin:0;background:#faf8f5;color:#2a2a2a}
.wrap{max-width:900px;margin:0 auto;padding:1.5rem 1rem 3rem}
a{color:#2980b9}
.crumbs{font-size:0.85rem;color:#888;margin-bottom:1rem}
.crumbs a{color:#888;text-decoration:none}
h1{font-size:1.7rem;font-weight:800;color:#1a1a1a;margin:0 0 0.4rem}
.lead{color:#777;font-size:0.95rem;margin:0 0 1.5rem}
.cats{display:flex;flex-wrap:wrap;gap:0.5rem;margin:0 0 2rem;padding:0;list-style:none}
.cats a{display:inline-block;padding:0.35rem 0.8rem;border-radius:999px;background:#fff;border:1px solid #e3ddd4;text-decoration:none;color:#555;font-size:0.85rem}
.cats a.on{background:#c0392b;border-color:#c0392b;color:#fff;font-weight:700}
.list{display:grid;grid-template-columns:1fr;gap:0.7rem;margin:0 0 2rem}
.item{display:block;background:#fff;border:1px solid #eae4db;border-radius:10px;padding:0.9rem 1rem;text-decoration:none;color:inherit}
.item h2{font-size:1rem;font-weight:700;color:#1a1a1a;margin:0 0 0.3rem;line-height:1.4}
.item p{font-size:0.85rem;color:#777;margin:0 0 0.3rem;line-height:1.45}
.item time{font-size:0.75rem;color:#aaa}
.pages{display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center}
.pages a,.pages span{display:inline-block;min-width:2rem;text-align:center;padding:0.35rem 0.5rem;border-radius:6px;border:1px solid #e3ddd4;background:#fff;text-decoration:none;color:#555;font-size:0.85rem}
.pages span.cur{background:#c0392b;border-color:#c0392b;color:#fff;font-weight:700}
.sitehead{background:#fff;border-bottom:1px solid #eae4db}
.sitehead .wrap{padding-top:0.9rem;padding-bottom:0.9rem;display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;font-size:1.1rem;color:#c0392b;text-decoration:none}
.foot{color:#aaa;font-size:0.8rem;margin-top:2.5rem;border-top:1px solid #eae4db;padding-top:1rem}
</style>
</head>`
}

function siteHeaderHtml(): string {
  return `<header class="sitehead"><div class="wrap"><a class="brand" href="/">СоветыДома</a><a href="/stati/" style="font-size:0.85rem;text-decoration:none">Все рубрики</a></div></header>`
}

function categoryChips(categories: Array<{ slug: string; name: string }>, active: string | null): string {
  const items = categories
    .map((c) => `<li><a class="${c.slug === active ? 'on' : ''}" href="/stati/${encodeURIComponent(c.slug)}/">${escapeHtml(c.name)}</a></li>`)
    .join('')
  return `<ul class="cats">${items}</ul>`
}

export interface HubCategory {
  slug: string
  name: string
}

/** /stati/ — index of the 12 category hubs. */
export function buildHubIndexHtml(categories: HubCategory[], siteUrl: string): string {
  const title = 'Все рубрики: полный список материалов — СоветыДома'
  const description = 'Полный список всех опубликованных материалов СоветыДома по рубрикам: кулинария, дача, дом, экономия и другие.'
  return `<!DOCTYPE html>
<html lang="ru">
${hubHead({ title, description, canonical: `${siteUrl}/stati/` })}
<body>
${siteHeaderHtml()}
<main class="wrap">
<nav class="crumbs" aria-label="Путь к странице"><a href="/">Главная</a> › <span>Все материалы</span></nav>
<h1>Все материалы по рубрикам</h1>
<p class="lead">Полный архив опубликованных статей сайта СоветыДома. Выберите рубрику, чтобы увидеть все её материалы в хронологическом порядке.</p>
${categoryChips(categories, null)}
</main>
<footer class="wrap foot">© СоветыДома — практичные советы для дома</footer>
</body>
</html>`
}

/** /stati/<category>/ and /stati/<category>/<page>/ — paginated article listing. */
export function buildHubHtml(opts: {
  siteUrl: string
  category: HubCategory
  categories: HubCategory[]
  articles: Array<{ slug: string; title: string; description: string | null; published_at: string }>
  page: number
  totalPages: number
  totalItems: number
}): string {
  const { siteUrl, category, page, totalPages, totalItems } = opts
  const basePath = `/stati/${encodeURIComponent(category.slug)}`
  const canonical = page === 1 ? `${siteUrl}${basePath}/` : `${siteUrl}${basePath}/${page}/`
  const title = page === 1
    ? `${category.name}: все материалы рубрики — СоветыДома`
    : `${category.name}: все материалы, страница ${page} — СоветыДома`
  const description = `Полный список материалов рубрики «${category.name}» на СоветыДома — ${totalItems} шт.${totalPages > 1 ? ` Страница ${page} из ${totalPages}.` : ''}`

  const items = opts.articles.map((a) => {
    const date = a.published_at.slice(0, 10)
    const desc = a.description ? `<p>${escapeHtml(a.description)}</p>` : ''
    return `<a class="item" href="/${encodeURIComponent(category.slug)}/${encodeURIComponent(a.slug)}/"><h2>${escapeHtml(a.title)}</h2>${desc}<time dateTime="${escapeHtml(date)}">${escapeHtml(date)}</time></a>`
  }).join('\n')

  let pagination = ''
  if (totalPages > 1) {
    const parts: string[] = []
    if (page > 1) {
      const prev = page - 1 === 1 ? `${basePath}/` : `${basePath}/${page - 1}/`
      parts.push(`<a rel="prev" href="${prev}">←</a>`)
    }
    // Window of page links around the current page (deterministic, compact)
    const from = Math.max(1, page - 3)
    const to = Math.min(totalPages, page + 3)
    if (from > 1) parts.push(`<a href="${basePath}/">1</a>`)
    if (from > 2) parts.push('<span>…</span>')
    for (let p = from; p <= to; p++) {
      if (p === page) parts.push(`<span class="cur">${p}</span>`)
      else parts.push(`<a href="${p === 1 ? `${basePath}/` : `${basePath}/${p}/`}">${p}</a>`)
    }
    if (to < totalPages - 1) parts.push('<span>…</span>')
    if (to < totalPages) parts.push(`<a href="${basePath}/${totalPages}/">${totalPages}</a>`)
    if (page < totalPages) parts.push(`<a rel="next" href="${basePath}/${page + 1}/">→</a>`)
    pagination = `<nav class="pages" aria-label="Страницы">${parts.join('')}</nav>`
  }

  const empty = totalItems === 0
    ? '<p class="lead">В этой рубрике пока нет динамически опубликованных материалов.</p>'
    : ''

  return `<!DOCTYPE html>
<html lang="ru">
${hubHead({ title, description, canonical })}
<body>
${siteHeaderHtml()}
<main class="wrap">
<nav class="crumbs" aria-label="Путь к странице"><a href="/">Главная</a> › <a href="/${encodeURIComponent(category.slug)}/">${escapeHtml(category.name)}</a> › <span>Все материалы</span></nav>
<h1>${escapeHtml(category.name)}: все материалы</h1>
<p class="lead">Полный хронологический список материалов рубрики «${escapeHtml(category.name)}» — ${totalItems} шт. Основная страница рубрики: <a href="/${encodeURIComponent(category.slug)}/">${escapeHtml(category.name)}</a>.</p>
${categoryChips(opts.categories, category.slug)}
${empty}
<div class="list">
${items}
</div>
${pagination}
</main>
<footer class="wrap foot">© СоветыДома — практичные советы для дома</footer>
</body>
</html>`
}
