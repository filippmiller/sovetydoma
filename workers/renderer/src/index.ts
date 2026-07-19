// NO-REDEPLOY publishing: this worker makes article publishing rebuild-free.
// See docs/NO-REDEPLOY-PUBLISHING.md

/**
 * sovetydoma-renderer — Cloudflare Worker
 *
 * Dynamically renders article pages for the static-export Next.js site 1001sovet.ru.
 * Caddy reverse-proxies requests for articles not present as static files to this worker.
 *
 * Routes:
 *   GET /:category/:slug/         → full SEO HTML for a published DB article
 *   GET /images/<filename>        → stream article image from R2
 *   GET /sitemap-dynamic.xml      → sitemap for dynamically-published articles
 *   GET /stati/                   → hub: index of all category hubs
 *   GET /stati/<category>/        → hub: paginated listing of dynamic articles
 *   GET /stati/<category>/<page>/ → hub: page N of the listing
 *
 * Internal linking (SEO, 2026-07): every dynamic article gets a server-rendered
 * "Читайте также" block (related same-category articles + hub link), and the
 * /stati/ hub pages list every dynamic article with crawlable <a href> links.
 * See src/links.ts (pure functions, unit-tested).
 */

import { mdToHtml, slugify } from './md'
import { articleImageFilename, buildJsonLd, CATEGORY_NAMES, resolvePersona, type ArticleRow } from './jsonld'
import { fetchTemplate } from './template'
import { BAKED_CSS } from './bakedCss'
import {
  buildCommentsHtml,
  buildQuestionsHtml,
  type DynamicComment,
  type DynamicQuestion,
} from './ugc'
import {
  buildFavoriteHtml,
  buildPushHtml,
  buildRatingHtml,
  buildReactionsHtml,
} from './pe-islands'
import {
  buildHubHtml,
  buildHubIndexHtml,
  buildRelatedHtml,
  fetchAllPages,
  HUB_PAGE_SIZE,
  paginate,
  selectRelated,
  type HubCategory,
  type RelatedCandidate,
} from './links'
import {
  RENDER_VERSION,
  articleCacheUrl,
  categoryRowsCacheUrl,
  dzenFeedCacheUrl,
  hubCacheUrl,
  siteBaseUrl,
  sitemapCacheUrl,
} from './cacheKeys'
import { handlePurge } from './purge'
import { buildDzenFeed, selectDailyDzenRows, type DzenRow } from './dzen'

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

interface Env {
  ARTICLE_IMAGES: R2Bucket
  SUPABASE_URL: string          // e.g. https://api.1001sovet.ru (REST proxy)
  SUPABASE_SERVICE_ROLE_KEY: string // wrangler secret bulk
  TEMPLATE_URL: string          // e.g. https://1001sovet.ru/ekonomiya/ekonomiya-vody/
  SITE_URL: string              // https://1001sovet.ru
  R2_UPLOAD_SECRET?: string     // shared secret for the authenticated PUT /__r2/ upload
  RENDERER_PURGE_SECRET?: string // shared secret for POST /__purge (wrangler secret bulk)
  DZEN_FEED_START_DATE?: string // YYYY-MM-DD; prevents an initial historical import flood
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function slugParam(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120)
}

function categoryParam(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80)
}

const ARTICLE_RESPONSE_CACHE_TTL = 300 // seconds

// ---------------------------------------------------------------------------
// Supabase REST fetch
// ---------------------------------------------------------------------------

const DB_TIMEOUT_MS = 5000

async function fetchArticle(env: Env, category: string, slug: string): Promise<ArticleRow | null> {
  const base = env.SUPABASE_URL.replace(/\/+$/, '')
  const select = 'slug,category,title,description,body_md,tags,image_filename,frontmatter,published_at,updated_at,word_count'
  const params = new URLSearchParams({
    slug: `eq.${slug}`,
    category: `eq.${category}`,
    text_status: 'eq.published',
    domain: 'eq.1001sovet.ru',
    select,
    limit: '1',
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await fetch(`${base}/rest/v1/content_matrix?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    clearTimeout(timer)
    throw new Error(`db_fetch_failed: ${String(err)}`) // 503 upstream, NOT 404
  }
  clearTimeout(timer)

  if (!resp.ok) throw new Error(`db_fetch_${resp.status}`)

  const rows = await resp.json() as ArticleRow[]
  return rows[0] ?? null
}

async function fetchUgcRows<T>(env: Env, table: string, params: URLSearchParams): Promise<T[]> {
  const base = env.SUPABASE_URL.replace(/\/+$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await fetch(`${base}/rest/v1/${table}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    })
  } finally {
    clearTimeout(timer)
  }
  if (!resp.ok) throw new Error(`ugc_${table}_${resp.status}`)
  return resp.json() as Promise<T[]>
}

function fetchApprovedQuestions(env: Env, slug: string): Promise<DynamicQuestion[]> {
  return fetchUgcRows<DynamicQuestion>(env, 'questions', new URLSearchParams({
    article_slug: `eq.${slug}`,
    status: 'eq.approved',
    select: 'slug,title,answers_count',
    order: 'created_at.desc',
    limit: '20',
  }))
}

function fetchApprovedComments(env: Env, slug: string): Promise<DynamicComment[]> {
  return fetchUgcRows<DynamicComment>(env, 'comments', new URLSearchParams({
    article_slug: `eq.${slug}`,
    is_approved: 'eq.true',
    is_deleted: 'eq.false',
    select: 'id,content,parent_id,created_at',
    order: 'created_at.asc',
    limit: '100',
  }))
}

/**
 * Fetch ALL published+active rows of a category (static + dynamic) for
 * related-links selection and hub pages. Paginates explicitly because
 * PostgREST caps a single response (commonly 1,000 rows). Result is cached
 * in the Cache API for CATEGORY_ROWS_CACHE_TTL seconds so article renders
 * do not hit the DB on every request.
 */
const CATEGORY_ROWS_CACHE_TTL = 600 // seconds

async function fetchCategoryRows(env: Env, category: string): Promise<RelatedCandidate[]> {
  const cacheKey = new Request(categoryRowsCacheUrl(siteBaseUrl(env), category))
  const cache = caches.default
  const cached = await cache.match(cacheKey)
  if (cached) return cached.json() as Promise<RelatedCandidate[]>

  const base = env.SUPABASE_URL.replace(/\/+$/, '')

  const rows = await fetchAllPages<RelatedCandidate>(async (offset, limit) => {
    const params = new URLSearchParams({
      category: `eq.${category}`,
      text_status: 'eq.published',
      disposition: 'eq.active',
      domain: 'eq.1001sovet.ru',
      select: 'slug,category,title,description,tags,image_filename,published_at,text_status,published_via:frontmatter->>published_via',
      order: 'published_at.desc,slug.asc',
      limit: String(limit),
      offset: String(offset),
    })

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS)
    let resp: Response
    try {
      resp = await fetch(`${base}/rest/v1/content_matrix?${params.toString()}`, {
        signal: controller.signal,
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Accept: 'application/json',
        },
      })
    } catch (err) {
      clearTimeout(timer)
      throw new Error(`db_fetch_failed: ${String(err)}`)
    }
    clearTimeout(timer)

    if (!resp.ok) throw new Error(`db_fetch_${resp.status}`)
    return resp.json() as Promise<RelatedCandidate[]>
  }, { maxRows: 10_000 })

  const cacheResp = new Response(JSON.stringify(rows), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CATEGORY_ROWS_CACHE_TTL}`,
    },
  })
  cache.put(cacheKey, cacheResp).catch(() => {/* ignore */})
  return rows
}

// ---------------------------------------------------------------------------
// Format helpers (mirrors src/lib/utils.ts)
// ---------------------------------------------------------------------------

function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function relativeDate(dateStr: string): string {
  const now = Date.now()
  const ms = now - new Date(dateStr).getTime()
  if (ms < 0) return 'сегодня'
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  if (days < 28) return `${Math.floor(days / 7)} нед. назад`
  if (days < 365) return `${Math.floor(days / 30)} мес. назад`
  return `${Math.floor(days / 365)} г. назад`
}


const DIFFICULTY_STARS: Record<string, number> = {
  'Легко': 1,
  'Средне': 3,
  'Сложно': 5,
}

function readFrontmatterArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

function buildMetaBadgesHtml(fm: Record<string, unknown>): string {
  const badges: string[] = []
  const difficulty = typeof fm.difficulty === 'string' ? fm.difficulty.trim() : ''
  const time = typeof fm.time === 'string' ? fm.time.trim() : ''
  const cost = typeof fm.cost === 'string' ? fm.cost.trim() : ''
  const difficultyStars: Record<string, number> = { 'Легко': 1, 'Средне': 3, 'Сложно': 5 }
  const stars = difficultyStars[difficulty]
  if (stars) {
    badges.push(`<span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.78rem;font-weight:700;color:#555;background:#f5f2ed;border:1px solid #e9e3db;border-radius:999px;padding:0.2rem 0.65rem" aria-label="Сложность ${escapeHtml(difficulty)}"><span style="color:#f39c12">${'★'.repeat(stars)}</span><span style="color:#c1b8ad">${'☆'.repeat(5 - stars)}</span></span>`)
  }
  if (time) {
    badges.push(`<span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.78rem;font-weight:700;color:#555;background:#f5f2ed;border:1px solid #e9e3db;border-radius:999px;padding:0.2rem 0.65rem">⏱ ${escapeHtml(time)}</span>`)
  }
  if (cost) {
    badges.push(`<span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.78rem;font-weight:700;color:#555;background:#f5f2ed;border:1px solid #e9e3db;border-radius:999px;padding:0.2rem 0.65rem">💰 ${escapeHtml(cost)}</span>`)
  }
  return badges.join('')
}

function buildQuickAnswerHtml(fm: Record<string, unknown>): string | null {
  const quickAnswer = typeof fm.quickAnswer === 'string' ? fm.quickAnswer.trim() : ''
  if (!quickAnswer) return null
  const time = typeof fm.time === 'string' ? fm.time.trim() : ''
  const difficulty = typeof fm.difficulty === 'string' ? fm.difficulty.trim() : ''
  const forWhom = typeof fm.forWhom === 'string' ? fm.forWhom.trim() : ''
  const needs = readFrontmatterArray(fm.needs)
  const stars = difficulty ? DIFFICULTY_STARS[difficulty] : undefined
  const meta: string[] = []
  if (time) {
    meta.push(`<div><div style="font-size:0.72rem;font-weight:700;color:#8a8378;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem">⏱ Время</div><div style="font-size:0.92rem;color:#2a2a2a;line-height:1.45">${escapeHtml(time)}</div></div>`)
  }
  if (stars) {
    meta.push(`<div><div style="font-size:0.72rem;font-weight:700;color:#8a8378;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem">📊 Сложность</div><div style="font-size:0.92rem;color:#2a2a2a;line-height:1.45" aria-label="Сложность ${escapeHtml(difficulty)}"><span style="color:#f39c12">${'★'.repeat(stars)}</span><span style="color:#ddd">${'☆'.repeat(5 - stars)}</span></div></div>`)
  }
  if (needs.length > 0) {
    meta.push(`<div style="grid-column:1 / -1"><div style="font-size:0.72rem;font-weight:700;color:#8a8378;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem">🧰 Что понадобится</div><div style="font-size:0.92rem;color:#2a2a2a;line-height:1.45">${escapeHtml(needs.join(', '))}</div></div>`)
  }
  if (forWhom) {
    meta.push(`<div style="grid-column:1 / -1"><div style="font-size:0.72rem;font-weight:700;color:#8a8378;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.2rem">👤 Для кого подходит</div><div style="font-size:0.92rem;color:#2a2a2a;line-height:1.45">${escapeHtml(forWhom)}</div></div>`)
  }
  const metaHtml = meta.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:0.75rem;margin-top:1rem">${meta.join('')}</div>`
    : ''
  return `<div style="font-size:0.72rem;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#c0392b;margin-bottom:0.5rem">⚡ Краткий ответ</div><p style="margin:0;font-size:1rem;line-height:1.6;color:#2a2a2a">${escapeHtml(quickAnswer)}</p>${metaHtml}`
}

// ---------------------------------------------------------------------------
// 404 page
// ---------------------------------------------------------------------------

function notFoundHtml(siteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Страница не найдена — СоветыДома</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:1rem;text-align:center;color:#333}
a{color:#c0392b}</style>
</head>
<body>
<h1>Страница не найдена</h1>
<p>Эта статья пока недоступна или не существует.</p>
<p><a href="${escapeHtml(siteUrl)}/">← На главную</a></p>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// HTMLRewriter-based template transform
// ---------------------------------------------------------------------------

/**
 * Known HTML structure of the template page (ekonomiya/ekonomiya-vody/).
 * Selectors are stable — they target elements present in the compiled Next.js output.
 *
 * Template HTML snippets we match against (verified from live site fetch):
 *
 * <title>…</title>
 *
 * <nav aria-label="Путь к странице" …>
 *   <ol …>
 *     <li><a href="/">Главная</a></li>
 *     <li …><span>›</span><a href="/ekonomiya/">Экономия</a></li>
 *     <li …><span>›</span><span aria-current="page">Как сократить…</span></li>
 *   </ol>
 * </nav>
 *
 * <h1 style="font-size:2rem;font-weight:800;…">…title…</h1>
 *
 * <figure style="position:relative;…">
 *   <img src="/images/ekonomiya-vody.jpg" alt="…" …/>
 * </figure>
 *
 * <time dateTime="2026-05-31" title="31 мая 2026 г." …>…</time>
 *
 * Category badge: <span style="display:inline-block;background-color:#…18;…">Экономия</span>
 *   (first span inside the header's first div)
 *
 * Tags: <a style="padding:4px 10px;border-radius:4px;background-color:#f0ede8;…" href="/tag/…">…</a>
 *
 * <article class="prose">…body…</article>
 *
 * JSON-LD: <script type="application/ld+json">…</script>  (multiple)
 *
 * Related articles block: left as-is from template (v1 decision — it carries the
 * template article's related links; acceptable since it doesn't claim a category label
 * in a way that breaks SEO. Hiding it would require extra selector work for minimal gain.)
 */

function buildTransformer(
  row: ArticleRow,
  siteUrl: string,
  bodyHtml: string,
  schemas: { article: object; breadcrumb: object; extra: object[] },
  relatedHtml: string | null,
  ugcHtml: {
    questions: string
    comments: string
    reactions: string
    rating: string
    favorite: string
    push: string
  },
) {
  const categoryName = CATEGORY_NAMES[row.category] ?? row.category
  const persona = resolvePersona((row.frontmatter as Record<string, string | undefined>)?.author, row.category)
  const canonicalUrl = `${siteUrl}/${row.category}/${row.slug}/`
  const imageFilename = articleImageFilename(row)
  const imageUrl = `${siteUrl}/images/${imageFilename}`
  const pageTitle = `${row.title} — СоветыДома`
  const description = row.description
  const fm = row.frontmatter as Record<string, unknown>
  const quickAnswerHtml = buildQuickAnswerHtml(fm)
  const metaBadgesHtml = buildMetaBadgesHtml(fm)
  const dateIso = row.published_at.slice(0, 10)
  const dateFormatted = formatDateRu(dateIso)
  const dateRelative = relativeDate(dateIso)
  // Push PE is injected once next to the /podpiski text CTA (SSR-null on template).
  let pushInjected = false

  // Build tag links HTML
  const tagLinksHtml = (Array.isArray(row.tags) ? row.tags : [])
    .map((tag) => `<a style="padding:4px 10px;border-radius:4px;background-color:#f0ede8;color:#666;font-size:0.8rem;text-decoration:none" href="/tag/${encodeURIComponent(tag)}/">#${escapeHtml(tag)}</a>`)
    .join('')

  // Date/time inner HTML
  const timeInnerHtml = `<span>📅 ${escapeHtml(dateFormatted)} <span style="opacity:0.7">(${escapeHtml(dateRelative)})</span></span>`

  // Breadcrumb inner HTML (we replace the whole <ol> content)
  const breadcrumbOlHtml = `<li><a style="color:#888;text-decoration:none" href="/">Главная</a></li>`
    + `<li style="display:flex;align-items:center;gap:0.3rem"><span style="color:#ccc">›</span><a style="color:#888;text-decoration:none" href="/${escapeHtml(row.category)}/">${escapeHtml(categoryName)}</a></li>`
    + `<li style="display:flex;align-items:center;gap:0.3rem"><span style="color:#ccc">›</span><span style="color:#444" aria-current="page">${escapeHtml(row.title)}</span></li>`

  // JSON-LD scripts to inject (we remove existing ones first then append),
  // plus the baked styled-jsx CSS (header etc.) that normally arrives via JS.
  const extraScripts = schemas.extra.map((schema) => `<script type="application/ld+json">${JSON.stringify(schema)}</script>`).join('')
  const jsonLdHtml = `<script type="application/ld+json">${JSON.stringify(schemas.article)}</script>`
    + `<script type="application/ld+json">${JSON.stringify(schemas.breadcrumb)}</script>`
    + extraScripts
    + `<style>${BAKED_CSS}</style>`

  // TOC entries from our h2 headings (ids must match md.ts renderBlock)
  const tocLinks = (row.body_md ?? '')
    .split('\n')
    .filter((l) => /^## /.test(l))
    .map((l) => l.replace(/^## /, '').replace(/[*_`]/g, '').trim())
    .map((text) => `<a href="#${escapeHtml(slugify(text))}">${escapeHtml(text)}</a>`)
    .join('')
  const tocHtml = `<div class="toc-title">Содержание</div>${tocLinks}`

  // State flags for HTMLRewriter handlers
  let jsonLdAppended = false
  let inH1 = false
  let h1Done = false
  let inFigure = false
  let inFigureImg = false
  let timeDone = false
  let categorySpanDone = false
  // For tags container: div containing the tag <a> links
  let inTagsDiv = false
  const tagsDone = false

  return new HTMLRewriter()
    // ── <title> ──────────────────────────────────────────────────────────
    .on('title', {
      text(chunk) {
        if (chunk.lastInTextNode) {
          chunk.replace(escapeHtml(pageTitle))
        } else {
          chunk.remove()
        }
      },
    })
    // ── <meta> and <link> in <head> ──────────────────────────────────────
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute('content', description)
      },
    })
    .on('meta[name="keywords"]', {
      element(el) {
        el.setAttribute('content', row.tags.join(', '))
      },
    })
    .on('meta[name="category"]', {
      element(el) {
        el.setAttribute('content', categoryName)
      },
    })
    .on('meta[property="article:section"]', {
      element(el) {
        el.setAttribute('content', categoryName)
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute('href', canonicalUrl)
      },
    })
    .on('meta[property^="og:"]', {
      element(el) {
        const prop = el.getAttribute('property') ?? ''
        if (prop === 'og:title') el.setAttribute('content', row.title)
        else if (prop === 'og:description') el.setAttribute('content', description)
        else if (prop === 'og:url') el.setAttribute('content', canonicalUrl)
        else if (prop === 'og:image') el.setAttribute('content', imageUrl)
        else if (prop === 'og:image:alt') el.setAttribute('content', row.title)
        else if (prop === 'og:type') el.setAttribute('content', 'article')
      },
    })
    .on('meta[name^="twitter:"]', {
      element(el) {
        const name = el.getAttribute('name') ?? ''
        if (name === 'twitter:title') el.setAttribute('content', row.title)
        else if (name === 'twitter:description') el.setAttribute('content', description)
        else if (name === 'twitter:image') el.setAttribute('content', imageUrl)
      },
    })
    .on('a[href^="https://t.me/share/url"]', {
      element(el) {
        el.setAttribute('href', `https://t.me/share/url?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(row.title)}`)
      },
    })
    .on('a[href^="https://wa.me/"]', {
      element(el) {
        el.setAttribute('href', `https://wa.me/?text=${encodeURIComponent(`${row.title} ${canonicalUrl}`)}`)
      },
    })
    .on('a[href^="https://vk.com/share.php"]', {
      element(el) {
        el.setAttribute('href', `https://vk.com/share.php?url=${encodeURIComponent(canonicalUrl)}&title=${encodeURIComponent(row.title)}`)
      },
    })
    .on('a[href^="/podpiski/?category="]', {
      element(el) {
        el.setAttribute('href', `/podpiski/?category=${encodeURIComponent(row.category)}#subscription-panel`)
        el.setAttribute('aria-label', `Подписаться на категорию ${categoryName}`)
      },
    })
    // ── JSON-LD: remove existing, inject fresh after last one ─────────────
    .on('script[type="application/ld+json"]', {
      element(el) {
        el.remove()
        // After the LAST ld+json script we inject ours (we do it in text handler;
        // since el.remove() removes the element including its children, we instead
        // inject after the element using onEndTag isn't available in CF HTMLRewriter,
        // so we append to <head> via the head handler below)
      },
      text(chunk) {
        chunk.remove()
      },
    })
    // ── Strip ALL Next.js scripts (chunks + inline Flight payload) ────────
    // The template's RSC/Flight payload describes the TEMPLATE article; if we
    // left it, React hydration would client-re-render the page back into the
    // template article. Dynamic pages are therefore served as pure static HTML
    // (no hydration → no ratings/comments widgets until the nightly fold-in).
    .on('script', {
      element(el) {
        const src = el.getAttribute('src')
        const type = el.getAttribute('type')
        if (src && src.startsWith('/_next/')) el.remove()
        else if (!src && !type) el.remove() // inline self.__next_f Flight chunks
      },
    })
    .on('link[rel="preload"][as="script"]', {
      element(el) {
        el.remove()
      },
    })
    // Append fresh JSON-LD to end of <head>
    .on('head', {
      element(el) {
        el.onEndTag((tag) => {
          if (!jsonLdAppended) {
            jsonLdAppended = true
            tag.before(jsonLdHtml, { html: true })
          }
        })
      },
    })
    // ── Breadcrumb nav → replace <ol> content ────────────────────────────
    .on('nav[aria-label="Путь к странице"] ol', {
      element(el) {
        el.setInnerContent(breadcrumbOlHtml, { html: true })
      },
    })
    // ── <h1> — first one inside article-main (the article title) ─────────
    .on('h1', {
      element() {
        if (!h1Done) {
          inH1 = true
          h1Done = true
        }
      },
      text(chunk) {
        if (inH1) {
          if (chunk.lastInTextNode) {
            chunk.replace(escapeHtml(row.title))
            inH1 = false
          } else {
            chunk.remove()
          }
        }
      },
    })
    // ── <figure> hero image — replace img src + alt ───────────────────────
    // The figure has inline style "position:relative;aspect-ratio:16 / 9;..."
    // We match the first figure on the page (the article hero).
    .on('figure', {
      element() {
        if (!inFigure) {
          inFigure = true
        }
      },
    })
    .on('figure img', {
      element(el) {
        if (inFigure && !inFigureImg) {
          inFigureImg = true
          el.setAttribute('src', `/images/${imageFilename}`)
          el.setAttribute('alt', row.title)
        }
      },
    })
    // ── <time> element — replace dateTime + inner text ────────────────────
    .on('time', {
      element(el) {
        if (!timeDone) {
          timeDone = true
          el.setAttribute('dateTime', dateIso)
          el.setAttribute('title', dateFormatted)
          el.setInnerContent(timeInnerHtml, { html: true })
        }
      },
    })
    // ── Category badge span (first span in header's category div) ─────────
    // Identified by inline style containing "text-transform:uppercase" and "font-weight:700"
    // which is the category label span in the article header.
    // Selector: header span[style*="text-transform:uppercase"]
    .on('header span[style*="text-transform:uppercase"]', {
      element(el) {
        if (!categorySpanDone) {
          categorySpanDone = true
          el.setInnerContent(escapeHtml(categoryName), { html: false })
        }
      },
    })
    // ── Tags div — replace inner content ─────────────────────────────────
    // The tags container is a div with style containing "flexWrap" and children are
    // <a style="padding:4px 10px;border-radius:4px;background-color:#f0ede8;...">
    // We identify it by the first <a href="/tag/"> inside a div after the article.prose.
    // Strategy: replace all tag <a> links that match the tag link style.
    // We do this by targeting links whose href starts with /tag/ and have the tag style.
    .on('a[href^="/tag/"]', {
      element(el) {
        const style = el.getAttribute('style') ?? ''
        if (style.includes('#f0ede8') && !tagsDone) {
          // Remove all existing tag links — we'll replace the first with our set,
          // then remove subsequent ones.
          if (!inTagsDiv) {
            inTagsDiv = true
            // Replace entire content of parent — we can't do that here, so instead
            // we replace the first tag link with all our tag links, and remove the rest.
            el.replace(tagLinksHtml, { html: true })
          } else {
            el.remove()
          }
        }
      },
      text() {
        // Suppress text of subsequent tag links (they are removed via el.remove())
      },
    })
    // ── Lead paragraph under <h1> (article description) ──────────────────
    .on('p[style*="font-size:1.05rem"]', {
      element(el) {
        el.setInnerContent(escapeHtml(description), { html: true })
      },
    })
    // ── «Краткий ответ» box — use frontmatter.quickAnswer when present ────
    .on('aside[aria-label="Краткий ответ"]', {
      element(el) {
        if (quickAnswerHtml) {
          el.setInnerContent(quickAnswerHtml, { html: true })
        } else {
          el.remove()
        }
      },
    })
    // ── Effort badges under the article description ───────────────────────
    .on('.article-meta-badges', {
      element(el) {
        el.setInnerContent(metaBadgesHtml, { html: true })
      },
    })
    // ── TOC (both nav.toc instances: sidebar + inline) ────────────────────
    .on('nav.toc', {
      element(el) {
        el.setInnerContent(tocHtml, { html: true })
      },
    })
    // ── Related articles — replace the template's (wrong-category) block ──
    // with our server-rendered "Читайте также" links (same category,
    // published only, no self-links). Falls back to dropping the section.
    .on('section.related-articles', {
      element(el) {
        if (relatedHtml) {
          el.setInnerContent(relatedHtml, { html: true })
        } else {
          el.remove()
        }
      },
    })
    // ── «С чего начать» summary (template's steps, wrong article) — drop ──
    .on('aside.article-action-summary', {
      element(el) {
        el.remove()
      },
    })
    // ── Author card: name link + role (persona must match the category) ──
    .on('a[href^="/author/"]', {
      element(el) {
        const style = el.getAttribute('style') ?? ''
        if (style.includes('color:#1a1a1a')) {
          el.setAttribute('href', `/author/${persona.slug}/`)
          el.setInnerContent(escapeHtml(persona.name), { html: true })
        }
      },
    })
    .on('[data-dynamic-widget="persona"] [data-persona-icon]', {
      element(el) {
        el.setInnerContent(persona.icon, { html: false })
      },
    })
    .on('div[style*="color:#777"]', {
      element(el) {
        el.setInnerContent(escapeHtml(persona.role), { html: true })
      },
    })
    // ── «Обновлено: …» in the author box ──────────────────────────────────
    .on('div[style*="color:#aaa"]', {
      element(el) {
        el.setInnerContent(`Обновлено: ${escapeHtml(dateFormatted)}`, { html: true })
      },
    })
    // ── <article class="prose"> — replace body content ───────────────────
    .on('article.prose', {
      element(el) {
        el.setInnerContent(bodyHtml, { html: true })
      },
    })
    // ── Dynamic UGC islands ──────────────────────────────────────────────
    // Next hydration is intentionally stripped because its Flight payload
    // belongs to the template article. Replace client-only loading states
    // with server-rendered approved rows (or honest empty/error states).
    .on('[data-dynamic-widget="questions"]', {
      element(el) {
        el.setInnerContent(ugcHtml.questions, { html: true })
      },
    })
    .on('[data-dynamic-widget="comments"]', {
      element(el) {
        el.setInnerContent(ugcHtml.comments, { html: true })
      },
    })
    // Auth-gated PE islands (reactions / rating / favorite / push). Prefer
    // data-dynamic-widget markers; fall back to the unique inline styles that
    // the current static template still emits for the dead client shells.
    // Combined selectors so each element is handled once even when it carries
    // both a marker and the legacy style.
    .on('[data-dynamic-widget="reactions"], div[style="margin-top:1.5rem"]', {
      element(el) {
        const marked = el.getAttribute('data-dynamic-widget') === 'reactions'
        const legacy = !el.getAttribute('data-dynamic-widget')
          && el.getAttribute('style') === 'margin-top:1.5rem'
        if (marked || legacy) el.replace(ugcHtml.reactions, { html: true })
      },
    })
    .on('[data-dynamic-widget="rating"], div[style="margin-top:2rem"]', {
      element(el) {
        const marked = el.getAttribute('data-dynamic-widget') === 'rating'
        const legacy = !el.getAttribute('data-dynamic-widget')
          && el.getAttribute('style') === 'margin-top:2rem'
        if (!marked && !legacy) return
        // Push is SSR-null on the current template (client-only). On the legacy
        // rating shell, append the push island once right after the stars.
        if (legacy && !pushInjected) {
          pushInjected = true
          el.replace(ugcHtml.rating + ugcHtml.push, { html: true })
        } else {
          el.replace(ugcHtml.rating, { html: true })
        }
      },
    })
    .on(
      '[data-dynamic-widget="favorite"], div[style="display:inline-flex;flex-direction:column;align-items:center;gap:4px;position:relative"]',
      {
        element(el) {
          const marked = el.getAttribute('data-dynamic-widget') === 'favorite'
          const legacy = !el.getAttribute('data-dynamic-widget')
            && el.getAttribute('style')
              === 'display:inline-flex;flex-direction:column;align-items:center;gap:4px;position:relative'
          if (marked || legacy) el.replace(ugcHtml.favorite, { html: true })
        },
      },
    )
    .on('[data-dynamic-widget="push"]', {
      element(el) {
        // After static rebuild, CategoryPushSubscribe shells exist and are
        // replaced here. Legacy path injects push after the rating shell above.
        el.replace(ugcHtml.push, { html: true })
        pushInjected = true
      },
    })
}

// ---------------------------------------------------------------------------
// Route: GET /:category/:slug/
// ---------------------------------------------------------------------------

async function handleArticle(req: Request, env: Env, category: string, slug: string): Promise<Response> {
  const siteUrl = siteBaseUrl(env)
  const cacheKey = new Request(articleCacheUrl(siteUrl, category, slug), { method: 'GET' })
  const cache = caches.default

  // Check article response cache first
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  // Fetch article from DB (with timeout)
  let row: ArticleRow | null
  try {
    row = await fetchArticle(env, category, slug)
  } catch {
    return new Response('Service temporarily unavailable — DB timeout', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': '10',
      },
    })
  }

  if (!row) {
    return new Response(notFoundHtml(siteUrl), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // word_count can be null in DB — JSON-LD must not claim 0 words
  if (!row.word_count) {
    row.word_count = (row.body_md ?? '').split(/\s+/).filter(Boolean).length
  }

  // Render markdown body
  const bodyHtml = mdToHtml(row.body_md ?? '')

  // Build JSON-LD schemas
  const schemas = buildJsonLd(row)

  // Related links (same category, published only). Failure must never break
  // article rendering — fall back to removing the template's related block.
  let relatedHtml: string | null = null
  try {
    const categoryRows = await fetchCategoryRows(env, row.category)
    const related = selectRelated(categoryRows, { slug: row.slug, tags: row.tags }, 6)
    if (related.length > 0) {
      relatedHtml = buildRelatedHtml(related, {
        category: row.category,
        categoryName: CATEGORY_NAMES[row.category] ?? row.category,
      })
    }
  } catch {
    relatedHtml = null
  }

  const [questionsResult, commentsResult] = await Promise.allSettled([
    fetchApprovedQuestions(env, row.slug),
    fetchApprovedComments(env, row.slug),
  ])
  const ugcHtml = {
    questions: buildQuestionsHtml(questionsResult.status === 'fulfilled' ? questionsResult.value : null, row.slug),
    comments: buildCommentsHtml(commentsResult.status === 'fulfilled' ? commentsResult.value : null, row.slug),
    reactions: buildReactionsHtml(row.slug),
    rating: buildRatingHtml(row.slug),
    favorite: buildFavoriteHtml(row.slug),
    push: buildPushHtml(row.category),
  }

  // Fetch template HTML (cached 10 min)
  const templateBase = (env.TEMPLATE_URL || `${siteUrl}/ekonomiya/ekonomiya-vody/`).replace(/\/+$/, '') + '/'
  const templateUrl = `${templateBase}?renderer-shell=${RENDER_VERSION}`
  let templateHtml: string
  try {
    templateHtml = await fetchTemplate(templateUrl)
  } catch (err) {
    return new Response(`Service temporarily unavailable — template fetch failed: ${String(err)}`, {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': '15',
      },
    })
  }

  // Apply HTMLRewriter transforms
  const transformer = buildTransformer(row, siteUrl, bodyHtml, schemas, relatedHtml, ugcHtml)
  const templateResp = new Response(templateHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
  const transformed = transformer.transform(templateResp)
  const finalHtml = await transformed.text()

  const response = new Response(finalHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${ARTICLE_RESPONSE_CACHE_TTL}, s-maxage=${ARTICLE_RESPONSE_CACHE_TTL * 2}`,
    },
  })

  // Cache the rendered page (non-blocking)
  const toCache = response.clone()
  cache.put(cacheKey, toCache).catch(() => {/* ignore */})

  return response
}

// ---------------------------------------------------------------------------
// Route: GET /images/<filename>
// ---------------------------------------------------------------------------

function mimeByExt(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    svg: 'image/svg+xml',
  }
  return map[ext] ?? 'application/octet-stream'
}

async function handleR2Put(req: Request, env: Env, url: URL): Promise<Response> {
  const secret = env.R2_UPLOAD_SECRET
  if (!secret || req.headers.get('x-r2-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }
  const key = decodeURIComponent(url.pathname.slice('/__r2/'.length))
  // Image keys only (optional previews/ prefix); blocks path traversal.
  if (!/^(previews\/)?[a-z0-9][a-z0-9-]*\.(jpe?g|png|webp)$/i.test(key)) {
    return new Response('bad key', { status: 400 })
  }
  const body = await req.arrayBuffer()
  if (body.byteLength === 0 || body.byteLength > 10 * 1024 * 1024) {
    return new Response('bad size', { status: 400 })
  }
  await env.ARTICLE_IMAGES.put(key, body, {
    httpMetadata: { contentType: req.headers.get('content-type') || 'image/jpeg' },
  })
  return new Response(JSON.stringify({ ok: true, key }), { status: 200, headers: { 'content-type': 'application/json' } })
}

async function handleImage(env: Env, filename: string): Promise<Response> {
  // Key matches the URL path after /images/ (incl. the previews/ prefix when present)
  const candidates = filename.startsWith('previews/') ? [filename] : [filename, `previews/${filename}`]
  for (const key of candidates) {
    const obj = await env.ARTICLE_IMAGES.get(key)
    if (obj) {
      const headers = new Headers()
      obj.writeHttpMetadata(headers)
      headers.set('Content-Type', mimeByExt(filename))
      headers.set('Cache-Control', 'public, max-age=86400, immutable')
      headers.set('ETag', obj.httpEtag)
      return new Response(obj.body, { status: 200, headers })
    }
  }
  return new Response('Image not found', { status: 404 })
}

// ---------------------------------------------------------------------------
// Route: GET /sitemap-dynamic.xml
// ---------------------------------------------------------------------------

interface SitemapRow {
  slug: string
  category: string
  published_at: string
  updated_at: string | null
}

async function handleSitemap(env: Env): Promise<Response> {
  const siteUrl = siteBaseUrl(env)
  // Version the internal cache key when sitemap generation semantics change;
  // otherwise an old edge entry can hide newly included URLs for an hour.
  const cacheKey = new Request(sitemapCacheUrl(siteUrl))
  const cache = caches.default

  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const base = env.SUPABASE_URL.replace(/\/+$/, '')
  const params = new URLSearchParams({
    text_status: 'eq.published',
    'frontmatter->>published_via': 'eq.dynamic',
    domain: 'eq.1001sovet.ru',
    select: 'slug,category,published_at,updated_at',
    order: 'published_at.desc,category.asc,slug.asc',
  })

  // PostgREST/Supabase commonly caps a single response at 1,000 rows even when
  // a larger `limit` is requested. Fetch explicit pages so older published
  // articles are not silently omitted from the sitemap.
  const pageSize = 1000
  const sitemapUrlLimit = 50_000
  const rows: SitemapRow[] = []

  while (rows.length < sitemapUrlLimit) {
    const pageParams = new URLSearchParams(params)
    pageParams.set('limit', String(pageSize))
    pageParams.set('offset', String(rows.length))

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS)
    let resp: Response
    try {
      resp = await fetch(`${base}/rest/v1/content_matrix?${pageParams.toString()}`, {
        signal: controller.signal,
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Accept: 'application/json',
        },
      })
    } catch {
      clearTimeout(timer)
      return new Response('Sitemap unavailable', {
        status: 503,
        headers: { 'Retry-After': '30' },
      })
    }
    clearTimeout(timer)

    if (!resp.ok) {
      return new Response('Sitemap DB error', { status: 503, headers: { 'Retry-After': '30' } })
    }

    const page = await resp.json() as SitemapRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }

  if (rows.length >= sitemapUrlLimit) {
    return new Response('Sitemap capacity exceeded', {
      status: 503,
      headers: { 'Retry-After': '3600' },
    })
  }

  const urls = rows.map((r) => {
    const loc = `${siteUrl}/${escapeHtml(r.category)}/${escapeHtml(r.slug)}/`
    const lastmod = (r.updated_at ?? r.published_at).slice(0, 10)
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
  }).join('\n')

  // Crawlable hub pages (/stati/…) — they carry the HTML links to all dynamic
  // articles, so they belong in the sitemap too. Counts come from the same
  // row set, so hub URLs and article URLs can never disagree.
  const perCategory = new Map<string, number>()
  for (const r of rows) perCategory.set(r.category, (perCategory.get(r.category) ?? 0) + 1)
  const hubUrls = [`  <url>\n    <loc>${siteUrl}/stati/</loc>\n  </url>`]
  for (const [cat, count] of [...perCategory.entries()].sort()) {
    if (count === 0) continue
    const pages = Math.ceil(count / HUB_PAGE_SIZE)
    for (let p = 1; p <= pages; p++) {
      const loc = p === 1 ? `${siteUrl}/stati/${escapeHtml(cat)}/` : `${siteUrl}/stati/${escapeHtml(cat)}/${p}/`
      hubUrls.push(`  <url>\n    <loc>${loc}</loc>\n  </url>`)
    }
  }

  const allUrls = hubUrls.join('\n') + (urls ? '\n' + urls : '')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allUrls}\n</urlset>`

  const response = new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })

  cache.put(cacheKey, response.clone()).catch(() => {/* ignore */})
  return response
}

// ---------------------------------------------------------------------------
// Routes: GET /stati/… — crawlable hub pages for dynamic articles
// ---------------------------------------------------------------------------

// Dzen imports the full article body from this RSS feed. Selecting the earliest
// Moscow-time publication of each day keeps the cadence at one stable item/day
// even though the content factory publishes several articles daily.
const DZEN_FEED_CACHE_TTL = 900

async function handleDzenFeed(env: Env): Promise<Response> {
  const siteUrl = siteBaseUrl(env)
  const cacheKey = new Request(dzenFeedCacheUrl(siteUrl))
  const cache = caches.default
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(env.DZEN_FEED_START_DATE || '')
    ? env.DZEN_FEED_START_DATE as string
    : '2026-07-19'
  const base = env.SUPABASE_URL.replace(/\/+$/, '')
  const params = new URLSearchParams({
    text_status: 'eq.published',
    disposition: 'eq.active',
    domain: 'eq.1001sovet.ru',
    published_at: `gte.${startDate}T00:00:00+03:00`,
    select: 'slug,category,title,description,body_md,image_filename,published_at',
    order: 'published_at.asc,slug.asc',
    limit: '1000',
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DB_TIMEOUT_MS)
  let upstream: Response
  try {
    upstream = await fetch(`${base}/rest/v1/content_matrix?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
      },
    })
  } catch {
    clearTimeout(timer)
    return new Response('Dzen feed unavailable', { status: 503, headers: { 'Retry-After': '30' } })
  }
  clearTimeout(timer)

  if (!upstream.ok) {
    return new Response('Dzen feed DB error', { status: 503, headers: { 'Retry-After': '30' } })
  }

  let rows = await upstream.json() as DzenRow[]

  // Keep the feed connectable while the content factory is temporarily idle:
  // bootstrap it with the latest published article, but do not expose a backlog.
  if (rows.length === 0) {
    const fallbackParams = new URLSearchParams(params)
    fallbackParams.delete('published_at')
    fallbackParams.set('order', 'published_at.desc,slug.asc')
    fallbackParams.set('limit', '1')
    const fallbackController = new AbortController()
    const fallbackTimer = setTimeout(() => fallbackController.abort(), DB_TIMEOUT_MS)
    try {
      const fallback = await fetch(`${base}/rest/v1/content_matrix?${fallbackParams.toString()}`, {
        signal: fallbackController.signal,
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Accept: 'application/json',
        },
      })
      if (fallback.ok) rows = await fallback.json() as DzenRow[]
    } catch {
      // The primary query succeeded, so an empty but valid feed is safer than
      // turning a transient bootstrap lookup failure into a 503.
    } finally {
      clearTimeout(fallbackTimer)
    }
  }

  const xml = buildDzenFeed(selectDailyDzenRows(rows), siteUrl)
  const response = new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${DZEN_FEED_CACHE_TTL}, s-maxage=${DZEN_FEED_CACHE_TTL}`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
  cache.put(cacheKey, response.clone()).catch(() => {/* ignore */})
  return response
}

const HUB_CACHE_TTL = 600 // seconds

const HUB_CATEGORIES: HubCategory[] = Object.entries(CATEGORY_NAMES).map(([slug, name]) => ({ slug, name }))

async function handleHub(env: Env, category: string | null, page: number): Promise<Response> {
  const siteUrl = siteBaseUrl(env)
  const cacheKey = new Request(hubCacheUrl(siteUrl, category, page))
  const cache = caches.default

  const cached = await cache.match(cacheKey)
  if (cached) return cached

  let html: string

  if (!category) {
    html = buildHubIndexHtml(HUB_CATEGORIES, siteUrl)
  } else {
    const categoryName = CATEGORY_NAMES[category]
    if (!categoryName) {
      return new Response(notFoundHtml(siteUrl), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    let rows: RelatedCandidate[]
    try {
      rows = await fetchCategoryRows(env, category)
    } catch {
      return new Response('Service temporarily unavailable — DB timeout', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '10' },
      })
    }

    // Hubs list dynamically-published articles only — static ones are already
    // linked from the main category page.
    const dynamic = rows.filter((r) => r.published_via === 'dynamic')
    const totalPages = Math.max(1, Math.ceil(dynamic.length / HUB_PAGE_SIZE))
    if (page > totalPages) {
      return new Response(notFoundHtml(siteUrl), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const pg = paginate(dynamic, page, HUB_PAGE_SIZE)
    html = buildHubHtml({
      siteUrl,
      category: { slug: category, name: categoryName },
      categories: HUB_CATEGORIES,
      articles: pg.items,
      page: pg.page,
      totalPages: pg.totalPages,
      totalItems: pg.totalItems,
    })
  }

  const response = new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${HUB_CACHE_TTL}, s-maxage=${HUB_CACHE_TTL * 2}`,
    },
  })
  cache.put(cacheKey, response.clone()).catch(() => {/* ignore */})
  return response
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // Authenticated R2 upload (so the content factory's CI publish step needs no
    // Cloudflare API token): PUT /__r2/<key> with header x-r2-secret + raw bytes.
    if (req.method === 'PUT' && url.pathname.startsWith('/__r2/')) {
      return handleR2Put(req, env, url)
    }

    // Targeted cache invalidation after a dynamic publish/update:
    // POST /__purge {category, slug?} with header x-purge-secret.
    if (url.pathname === '/__purge') {
      return handlePurge(req, env, (category) => fetchCategoryRows(env, category))
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const { pathname } = url

    // Dzen domain ownership fallback. The same file also lives in /public so it
    // remains available after the next static site deployment.
    if (pathname === '/zen_9GBGqu3l7j70QIjqAIEi38HTtJBvFw4LAh5fZLZ2vugYXbtiMWhNuU8WY87gEZ20.html') {
      return new Response('<meta name="zen-verification" content="9GBGqu3l7j70QIjqAIEi38HTtJBvFw4LAh5fZLZ2vugYXbtiMWhNuU8WY87gEZ20" />\n', {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    // /sitemap-dynamic.xml
    if (pathname === '/sitemap-dynamic.xml') {
      return handleSitemap(env)
    }

    // /stati/… — crawlable hub pages (also proxied by Caddy)
    if (pathname === '/zen.xml') {
      return handleDzenFeed(env)
    }

    const hubMatch = pathname.match(/^\/stati(?:\/([a-z0-9-]+)(?:\/(\d+))?)?(\/?)$/)
    if (hubMatch) {
      const siteUrl = (env.SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')
      const category = hubMatch[1] ?? null
      const page = hubMatch[2] ? parseInt(hubMatch[2], 10) : 1
      // Canonical form: trailing slash; page 1 lives at the bare category path.
      if (hubMatch[3] !== '/' || hubMatch[2] === '1') {
        const base = `/stati/${category ? `${category}/` : ''}`
        const target = hubMatch[2] && hubMatch[2] !== '1' ? `${base}${page}/` : base
        return Response.redirect(`${siteUrl}${target}`, 301)
      }
      return handleHub(env, category, page)
    }

    // /images/<filename> and /images/previews/<filename>
    const imagesMatch = pathname.match(/^\/images\/((?:previews\/)?[^/]+\.[a-z]{2,5})$/i)
    if (imagesMatch) {
      const filename = decodeURIComponent(imagesMatch[1])
      return handleImage(env, filename)
    }

    // /:category/:slug/  — canonical URLs have a trailing slash; redirect bare ones
    const articleMatch = pathname.match(/^\/([a-z0-9-]+)\/([a-z0-9-]+)(\/?)$/)
    if (articleMatch) {
      const category = categoryParam(articleMatch[1])
      const slug = slugParam(articleMatch[2])
      if (category && slug) {
        if (articleMatch[3] !== '/') {
          return Response.redirect(`${(env.SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')}/${category}/${slug}/`, 301)
        }
        return handleArticle(req, env, category, slug)
      }
    }

    return new Response('Not found', { status: 404 })
  },
}

export default worker
