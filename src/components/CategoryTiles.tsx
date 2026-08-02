import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'
import type { ArticleFrontmatter } from '@/lib/articles'

export interface CategoryTile {
  slug: string
  articles: (ArticleFrontmatter & { wordCount: number })[]
}

interface Props {
  tiles: CategoryTile[]
}

// Purely static/build-time — same reasoning as the "Только что" widget: this
// only needs article title/slug/date, all already known at build time, so no
// client component or Supabase round-trip is needed here.
export default function CategoryTiles({ tiles }: Props) {
  const visible = tiles.filter((t) => t.articles.length > 0 && CATEGORIES[t.slug])
  if (visible.length === 0) return null

  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.2rem' }}>
          По разделам
        </h2>
        <p style={{ fontSize: '0.83rem', color: '#999', margin: 0 }}>
          Весь сайт по темам — не только то, что попало в ленту
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {visible.map(({ slug, articles }) => {
          const cat = CATEGORIES[slug]
          const color = CATEGORY_COLOR[slug] || '#888'
          const emoji = CATEGORY_EMOJI[slug] || '📄'
          return (
            <div
              key={slug}
              style={{
                background: '#fff',
                borderRadius: '12px',
                border: '1px solid #e8e4df',
                padding: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <Link href={`/${slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <span style={{
                    fontSize: '1.1rem', width: '32px', height: '32px', flexShrink: 0,
                    borderRadius: '8px',
                    background: `linear-gradient(135deg, ${color}cc, ${color}66)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {emoji}
                  </span>
                  <span style={{ fontSize: '0.98rem', fontWeight: 800, color: '#1a1a1a' }}>
                    {cat.name}
                  </span>
                </div>
              </Link>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {articles.map((article) => (
                  <li key={article.slug} style={{ overflow: 'hidden' }}>
                    <Link
                      href={`/${slug}/${article.slug}`}
                      style={{
                        fontSize: '0.82rem', color: '#555', textDecoration: 'none', lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}
                    >
                      {article.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/${slug}`}
                style={{ fontSize: '0.78rem', color, textDecoration: 'none', fontWeight: 700, marginTop: 'auto' }}
              >
                Все советы →
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
