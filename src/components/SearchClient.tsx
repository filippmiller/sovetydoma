'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'
import { CATEGORY_COLOR, CATEGORY_EMOJI, relativeDate } from '@/lib/utils'

interface ArticleData {
  title: string
  description: string
  tags: string[]
  category: string
  categoryName: string
  slug: string
  date: string
  wordCount?: number
}

interface Props {
  articles: ArticleData[]
}

function scoreArticle(article: ArticleData, query: string): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  const terms = q.split(/\s+/)
  let score = 0
  for (const term of terms) {
    if (article.title.toLowerCase().includes(term)) score += 10
    if (article.description.toLowerCase().includes(term)) score += 5
    if (article.tags.some((t) => t.toLowerCase().includes(term))) score += 8
    if (article.categoryName.toLowerCase().includes(term)) score += 3
  }
  return score
}

export default function SearchClient({ articles }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 200)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  // Read URL param on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('q') || ''
      if (q) {
        setQuery(q)
        setDebouncedQuery(q)
      }
    }
  }, [])

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    return articles
      .map((a) => ({ ...a, score: scoreArticle(a, debouncedQuery) }))
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score)
  }, [debouncedQuery, articles])

  const hasQuery = debouncedQuery.trim().length > 0

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.4rem', color: '#1a1a1a' }}>
        Поиск
      </h1>
      <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        {articles.length} статей на сайте
      </p>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: '2rem' }}>
        <span style={{
          position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
          fontSize: '1.1rem', pointerEvents: 'none', color: '#aaa',
        }}>
          🔍
        </span>
        <input
          type="search"
          autoFocus
          placeholder="Введите запрос — например: борщ, уборка, огород..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.85rem 1rem 0.85rem 2.8rem',
            fontSize: '1rem',
            borderRadius: '10px',
            border: '2px solid #e8e4df',
            outline: 'none',
            backgroundColor: '#fff',
            boxSizing: 'border-box',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#c0392b' }}
          onBlur={(e) => { e.target.style.borderColor = '#e8e4df' }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{
              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#bbb', fontSize: '1.1rem', lineHeight: 1, padding: '4px',
            }}
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </div>

      {/* Results */}
      {hasQuery ? (
        results.length > 0 ? (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>
              Найдено: {results.length} {results.length === 1 ? 'статья' : results.length < 5 ? 'статьи' : 'статей'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.map((article) => {
                const color = CATEGORY_COLOR[article.category] || '#888'
                const emoji = CATEGORY_EMOJI[article.category] || '📄'
                const cat = CATEGORIES[article.category]
                return (
                  <Link
                    key={article.slug}
                    href={`/${article.category}/${article.slug}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      backgroundColor: '#fff',
                      borderRadius: '10px',
                      border: '1.5px solid #e8e4df',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget
                        el.style.borderColor = color
                        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget
                        el.style.borderColor = '#e8e4df'
                        el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{
                        width: '48px', height: '48px', flexShrink: 0,
                        borderRadius: '8px',
                        background: `linear-gradient(135deg, ${color}cc, ${color}66)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem',
                      }}>
                        {emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                            backgroundColor: color + '18', color,
                            borderRadius: '4px', padding: '2px 7px',
                          }}>
                            {cat?.name || article.categoryName}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#bbb' }}>{relativeDate(article.date)}</span>
                        </div>
                        <h3 style={{ fontSize: '0.97rem', fontWeight: 700, color: '#1a1a1a', margin: '0 0 0.3rem', lineHeight: 1.4 }}>
                          {article.title}
                        </h3>
                        <p style={{ fontSize: '0.83rem', color: '#666', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {article.description}
                        </p>
                        {article.tags.length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {article.tags.slice(0, 4).map((tag) => (
                              <span key={tag} style={{
                                fontSize: '0.72rem', color: '#999',
                                backgroundColor: '#f5f2ef', borderRadius: '3px', padding: '1px 6px',
                              }}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#444', marginBottom: '0.5rem' }}>
              Ничего не найдено
            </p>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              Попробуйте другой запрос или посмотрите все разделы ниже
            </p>
          </div>
        )
      ) : (
        /* Browse state — show categories and tag hints */
        <div>
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#555', marginBottom: '0.9rem' }}>По разделу</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {Object.values(CATEGORIES).map((cat) => {
                const color = CATEGORY_COLOR[cat.slug] || '#888'
                const emoji = CATEGORY_EMOJI[cat.slug] || '📄'
                const count = articles.filter((a) => a.category === cat.slug).length
                return (
                  <Link key={cat.slug} href={`/${cat.slug}`} style={{
                    padding: '0.5rem 1rem', borderRadius: '8px', border: `1.5px solid ${color}44`,
                    textDecoration: 'none', color, fontSize: '0.9rem', fontWeight: 600,
                    backgroundColor: color + '0d', display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}>
                    {emoji} {cat.name} <span style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 400 }}>({count})</span>
                  </Link>
                )
              })}
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#aaa', textAlign: 'center', padding: '1rem' }}>
            Начните вводить запрос для поиска по {articles.length} статьям
          </div>
        </div>
      )}
    </div>
  )
}
