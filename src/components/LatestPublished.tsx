'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'
import { CATEGORY_COLOR, CATEGORY_EMOJI, isRecentArticle, relativeDate } from '@/lib/utils'

// The static homepage build only ever sees src/content/articles (MDX files
// committed to the repo), which can go stale for weeks while the content
// factory keeps publishing straight into Supabase's content_matrix table
// (see docs/NO-REDEPLOY-PUBLISHING.md) — anon reads on that table are
// deliberately blocked, so there is no way to see those articles from a
// static build. This fetches a narrow, cached, read-only JSON view of the
// most recently published rows from a new renderer-worker endpoint
// (workers/renderer/src/index.ts handleLatest) — genuinely new content, not
// just "whatever ended up first after shuffling the static corpus"
// (that's what "Только что" below does).
const LATEST_API_URL = 'https://sovetydoma-renderer.filippmiller.workers.dev/api/latest.json?limit=8'

interface LatestRow {
  slug: string
  category: string
  title: string
  description: string | null
  image: string | null
  publishedAt: string
}

export default function LatestPublished() {
  const [rows, setRows] = useState<LatestRow[] | null>(null)

  useEffect(() => {
    let active = true
    fetch(LATEST_API_URL)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LatestRow[]) => {
        if (active) setRows(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (active) setRows([])
      })
    return () => { active = false }
  }, [])

  if (!rows || rows.length === 0) return null

  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.2rem' }}>
          🆕 Новое
        </h2>
        <p style={{ fontSize: '0.83rem', color: '#999', margin: 0 }}>
          Только что опубликовано на сайте
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {rows.map((row) => {
          const cat = CATEGORIES[row.category]
          const color = CATEGORY_COLOR[row.category] || '#888'
          const emoji = CATEGORY_EMOJI[row.category] || '📄'
          return (
            <Link
              key={row.slug}
              href={`/${row.category}/${row.slug}/`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
            >
              <article style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: '1px solid #f0ece7',
                padding: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) clamp(88px, 27%, 108px)',
                  gap: '0.8rem',
                  alignItems: 'start',
                  flex: 1,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                      {isRecentArticle(row.publishedAt, 2) && (
                        <span style={{
                          background: `${color}14`, color,
                          fontSize: '0.62rem', fontWeight: 800,
                          padding: '3px 7px', borderRadius: '4px',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          Новое
                        </span>
                      )}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        backgroundColor: `${color}12`, color,
                        borderRadius: '5px', padding: '3px 8px',
                        fontSize: '0.68rem', fontWeight: 750,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>
                        <span aria-hidden="true">{emoji}</span> {cat?.name || row.category}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 750, lineHeight: 1.35, margin: '0 0 0.45rem', color: '#1a1a1a' }}>
                      {row.title}
                    </h3>
                    {row.description && (
                      <p style={{
                        fontSize: '0.85rem', color: '#666', lineHeight: 1.55, margin: 0,
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {row.description}
                      </p>
                    )}
                  </div>
                  <div style={{
                    position: 'relative', aspectRatio: '1 / 1', width: '100%',
                    borderRadius: '8px', overflow: 'hidden', background: '#f4f0ea',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                  }}>
                    {/* Dynamic articles' images are served locally by the
                        renderer worker (/images/previews/<slug>.jpg), never
                        via Cloudinary — unlike the static corpus's images. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/images/previews/${row.slug}.jpg`}
                      alt={row.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid #f0ece7', fontSize: '0.74rem', color: '#aaa' }}>
                  {relativeDate(row.publishedAt)}
                </div>
              </article>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
