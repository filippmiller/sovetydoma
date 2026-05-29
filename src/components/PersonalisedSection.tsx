'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Article {
  slug: string
  title: string
  category: string
  categoryName: string
  date: string
  description: string
  tags: string[]
}

interface Props {
  articles: Article[]
}

export default function PersonalisedSection({ articles }: Props) {
  const [picks, setPicks] = useState<Article[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const history: Record<string, number> = JSON.parse(
      localStorage.getItem('viewed_categories') || '{}'
    )

    let selected: Article[]

    const entries = Object.entries(history)
    if (entries.length === 0) {
      // No history: show 4 most recent
      selected = [...articles]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4)
    } else {
      // Top 2 most-viewed categories
      const top2 = entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([cat]) => cat)

      selected = [...articles]
        .filter((a) => top2.includes(a.category))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 4)

      // Fallback if not enough articles in top categories
      if (selected.length < 4) {
        const extras = [...articles]
          .filter((a) => !top2.includes(a.category))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 4 - selected.length)
        selected = [...selected, ...extras]
      }
    }

    setPicks(selected)
    setMounted(true)
  }, [articles])

  if (!mounted || picks.length === 0) return null

  return (
    <section style={{ marginTop: '2.5rem', marginBottom: '1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.2rem' }}>
          🎯 Для вас
        </h2>
        <p style={{ fontSize: '0.83rem', color: '#999', margin: 0 }}>
          На основе ваших интересов
        </p>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '1rem',
      }}>
        {picks.map((article) => (
          <Link
            key={article.slug}
            href={`/${article.category}/${article.slug}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{
              padding: '0.9rem 1rem',
              borderRadius: '10px',
              border: '1px solid #e8e4df',
              backgroundColor: '#fff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              transition: 'box-shadow 0.15s',
            }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
              }}
            >
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#c0392b',
              }}>
                {article.categoryName}
              </span>
              <span style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#1a1a1a',
                lineHeight: 1.35,
              }}>
                {article.title}
              </span>
              <span style={{
                fontSize: '0.8rem',
                color: '#888',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {article.description}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#bbb', marginTop: 'auto' }}>
                {new Date(article.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
