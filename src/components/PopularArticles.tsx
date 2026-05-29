'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'
import { CATEGORIES } from '@/lib/categories'

interface ArticleData {
  title: string
  slug: string
  category: string
  categoryName: string
  date: string
}

interface Props {
  articles: ArticleData[]
}

export default function PopularArticles({ articles }: Props) {
  const [topArticles, setTopArticles] = useState<ArticleData[]>([])
  const [fromStorage, setFromStorage] = useState(false)

  useEffect(() => {
    try {
      const withViews = articles.map((a) => ({
        ...a,
        views: parseInt(localStorage.getItem(`views_${a.slug}`) || '0', 10),
      }))
      const hasAnyViews = withViews.some((a) => a.views > 0)
      if (hasAnyViews) {
        setFromStorage(true)
        setTopArticles(
          withViews.sort((a, b) => b.views - a.views).slice(0, 5)
        )
      } else {
        // Fallback: newest articles
        setTopArticles([...articles].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5))
      }
    } catch {
      setTopArticles([...articles].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5))
    }
  }, [articles])

  if (topArticles.length === 0) return null

  return (
    <section style={{
      margin: '2.5rem 0',
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e8e4df',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem' }}>
        <span style={{ fontSize: '1.2rem' }}>🔥</span>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          Популярное
        </h2>
        {fromStorage && (
          <span style={{ fontSize: '0.75rem', color: '#aaa', marginLeft: '0.25rem' }}>— по вашим просмотрам</span>
        )}
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {topArticles.map((article, i) => {
          const color = CATEGORY_COLOR[article.category] || '#888'
          const emoji = CATEGORY_EMOJI[article.category] || '📄'
          const cat = CATEGORIES[article.category]
          return (
            <li key={article.slug}>
              <Link
                href={`/${article.category}/${article.slug}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
              >
                <span style={{
                  fontWeight: 800, fontSize: '1rem', color: i === 0 ? '#c0392b' : '#ddd',
                  minWidth: '1.4rem', textAlign: 'center',
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize: '1rem', width: '28px', height: '28px', flexShrink: 0,
                  borderRadius: '6px',
                  background: `linear-gradient(135deg, ${color}cc, ${color}66)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {article.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '1px' }}>
                    {cat?.name || article.categoryName}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
