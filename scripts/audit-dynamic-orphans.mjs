// Audit: internal-link orphans among dynamically-published articles.
//
// A dynamic article is considered an ORPHAN when no other page of the site
// links to it with a crawlable HTML <a href>. Static surfaces (homepage,
// category pages, archive, related blocks) are built from MDX only and never
// reference dynamic articles (verified 2026-07-17), so the only possible
// inbound links come from bodies of other dynamic articles.
//
// Usage: node scripts/audit-dynamic-orphans.mjs [--json] [--via-hubs]
//   default:    body-link analysis via DB (needs SUPABASE_* in .env.local)
//   --via-hubs: crawl-based check against the LIVE site — fetches
//               sitemap-dynamic.xml and every hub page, then counts dynamic
//               articles not linked from any hub. No DB access needed.
// Read-only.

import helpers from './matrix/lib.mjs'

const DOMAIN = '1001sovet.ru'
const PAGE = 1000 // PostgREST max-rows safety: explicit pagination
const CATEGORIES = [
  'kulinaria', 'dom-i-uborka', 'dacha-i-ogorod', 'layfkhaki', 'ekonomiya', 'rybalka',
  'zdorovie-i-bezopasnost', 'semya-i-deti', 'krasota-i-uhod', 'otdyh-i-puteshestviya',
  'pokupki-i-tehnika', 'avto',
]
const LINK_RE = new RegExp(`\\((https://1001sovet\\.ru)?/(${CATEGORIES.join('|')})/([a-z0-9-]+)/?\\)`, 'g')

const sb = helpers.getServiceClient()

async function fetchAllPublishedDynamic() {
  const rows = []
  for (;;) {
    const { data, error } = await sb
      .from('content_matrix')
      .select('slug,category,body_md')
      .eq('domain', DOMAIN)
      .eq('text_status', 'published')
      .eq('frontmatter->>published_via', 'dynamic')
      .order('published_at', { ascending: false })
      .range(rows.length, rows.length + PAGE - 1)
    if (error) throw new Error(`content_matrix query: ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

if (process.argv.includes('--via-hubs')) {
  const BASE = 'https://1001sovet.ru'
  const sm = await (await fetch(`${BASE}/sitemap-dynamic.xml`)).text()
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  const articleUrls = locs.filter((u) => !u.includes('/stati/'))
  const hubUrls = locs.filter((u) => u.includes('/stati/') && u !== `${BASE}/stati/`)
  const linked = new Set()
  for (const hub of hubUrls) {
    const html = await (await fetch(hub)).text()
    for (const m of html.matchAll(/<a class="item" href="(\/[a-z0-9-]+\/[a-z0-9-]+\/)"/g)) {
      linked.add(BASE + m[1])
    }
  }
  const orphans = articleUrls.filter((u) => !linked.has(u))
  console.log(`sitemap articles: ${articleUrls.length}, hub pages: ${hubUrls.length}, linked from hubs: ${linked.size}`)
  console.log(`ORPHANS (not linked from any hub page): ${orphans.length}`)
  if (orphans.length) console.log(orphans.slice(0, 20))
  process.exit(orphans.length ? 1 : 0)
}

const rows = await fetchAllPublishedDynamic()
const key = (r) => `${r.category}/${r.slug}`
const dynamicKeys = new Set(rows.map(key))
const inbound = new Map() // key -> Set of source keys

for (const r of rows) {
  const body = r.body_md ?? ''
  LINK_RE.lastIndex = 0
  let m
  while ((m = LINK_RE.exec(body)) !== null) {
    const target = `${m[2]}/${m[3]}`
    if (target === key(r)) continue // self-link is not an inbound link
    if (!dynamicKeys.has(target)) continue // links to static articles don't help dynamic orphans
    if (!inbound.has(target)) inbound.set(target, new Set())
    inbound.get(target).add(key(r))
  }
}

const orphans = rows.filter((r) => !inbound.has(key(r)))
const byCategory = {}
for (const r of orphans) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1

const result = {
  date: new Date().toISOString().slice(0, 10),
  dynamicPublished: rows.length,
  withInboundHtmlLinks: rows.length - orphans.length,
  orphanPages: orphans.length,
  orphansByCategory: byCategory,
  note: 'Inbound = crawlable HTML links from bodies of other dynamic articles. Static surfaces link to 0 dynamic articles (verified). Sitemap is not counted as an internal link.',
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`Dynamic published articles: ${result.dynamicPublished}`)
  console.log(`With inbound HTML links:    ${result.withInboundHtmlLinks}`)
  console.log(`ORPHAN pages:               ${result.orphanPages}`)
  console.log('By category:', byCategory)
}
