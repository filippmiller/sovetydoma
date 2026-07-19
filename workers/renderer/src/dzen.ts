import { mdToHtml } from './md'

export interface DzenRow {
  slug: string
  category: string
  title: string
  description: string | null
  body_md: string | null
  image_filename: string | null
  published_at: string
}

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function cdata(value: string): string {
  return value.replace(/]]>/g, ']]]]><![CDATA[>')
}

export function moscowDay(timestamp: string): string {
  const time = Date.parse(timestamp)
  if (!Number.isFinite(time)) return ''
  return new Date(time + MOSCOW_OFFSET_MS).toISOString().slice(0, 10)
}

/** Keep one stable article per Moscow day; the day's earliest publication wins. */
export function selectDailyDzenRows(rows: DzenRow[], maxDays = 30): DzenRow[] {
  const earliestByDay = new Map<string, DzenRow>()

  for (const row of rows) {
    const day = moscowDay(row.published_at)
    if (!day) continue
    const current = earliestByDay.get(day)
    if (!current || Date.parse(row.published_at) < Date.parse(current.published_at)) {
      earliestByDay.set(day, row)
    }
  }

  return [...earliestByDay.values()]
    .sort((left, right) => Date.parse(right.published_at) - Date.parse(left.published_at))
    .slice(0, maxDays)
}

export function buildDzenFeed(rows: DzenRow[], siteUrl: string, now = new Date()): string {
  const base = siteUrl.replace(/\/+$/, '')
  const items = rows.map((row) => {
    const articleUrl = `${base}/${encodeURIComponent(row.category)}/${encodeURIComponent(row.slug)}/`
    const imageName = row.image_filename || `${row.slug}.jpg`
    const imageUrl = `${base}/images/${encodeURIComponent(imageName)}`
    const body = mdToHtml(row.body_md || '')
    const image = `<figure><img src="${escapeXml(imageUrl)}" alt="${escapeXml(row.title)}" /><figcaption>${escapeXml(row.title)}</figcaption></figure>`
    const fullHtml = `<h1>${escapeXml(row.title)}</h1>\n${image}\n${body}`

    return `  <item>
    <title>${escapeXml(row.title)}</title>
    <link>${escapeXml(articleUrl)}</link>
    <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>
    <description>${escapeXml(row.description || '')}</description>
    <pubDate>${new Date(row.published_at).toUTCString()}</pubDate>
    <enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" />
    <content:encoded><![CDATA[${cdata(fullHtml)}]]></content:encoded>
  </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>СоветыДома</title>
    <link>${escapeXml(base)}/</link>
    <description>Практичные советы для дома, кухни, дачи и повседневной жизни.</description>
    <language>ru</language>
    <atom:link href="${escapeXml(base)}/zen.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`
}
