'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { CATEGORY_COLOR, relativeDate } from '@/lib/utils'

interface RecipeArticle {
  title: string
  description: string
  slug: string
  category: string
  categoryName: string
  date: string
  tags: string[]
  prepTime?: string   // ISO 8601: PT5M, PT15M, PT30M …
  cookTime?: string
  recipeYield?: string
}

interface Props {
  recipes: RecipeArticle[]
}

/** Parse ISO 8601 duration (PT5M, PT1H30M, etc.) into total minutes */
function parsePrepMinutes(iso?: string): number | null {
  if (!iso) return null
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return null
  return (parseInt(m[1] || '0', 10) * 60) + parseInt(m[2] || '0', 10)
}

const TIME_FILTERS = [
  { label: 'Любое время', value: 'any' },
  { label: '≤ 15 минут', value: '15' },
  { label: '≤ 30 минут', value: '30' },
  { label: '≤ 60 минут', value: '60' },
]

export default function RecipeFilter({ recipes }: Props) {
  const [timeFilter, setTimeFilter] = useState<string>('any')
  const [activeTag, setActiveTag] = useState<string>('')

  // Collect all unique tags across recipes
  const allTags = useMemo(() => {
    const counts: Record<string, number> = {}
    recipes.forEach((r) => r.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [recipes])

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      // Time filter
      if (timeFilter !== 'any') {
        const limit = parseInt(timeFilter, 10)
        const prep = parsePrepMinutes(r.prepTime)
        if (prep === null || prep > limit) return false
      }
      // Tag filter
      if (activeTag && !r.tags.includes(activeTag)) return false
      return true
    })
  }, [recipes, timeFilter, activeTag])

  const color = CATEGORY_COLOR['kulinaria'] || '#e67e22'

  return (
    <div>
      {/* Filter bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '0.9rem' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
            Время приготовления
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {TIME_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setTimeFilter(value)}
                style={{
                  padding: '0.4rem 0.9rem',
                  borderRadius: '999px',
                  border: `2px solid ${timeFilter === value ? color : '#e0dbd5'}`,
                  backgroundColor: timeFilter === value ? color : '#fff',
                  color: timeFilter === value ? '#fff' : '#555',
                  fontSize: '0.85rem',
                  fontWeight: timeFilter === value ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>
              По теме
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button
                onClick={() => setActiveTag('')}
                style={{
                  padding: '3px 10px', borderRadius: '4px',
                  border: `1.5px solid ${!activeTag ? color : '#e0dbd5'}`,
                  backgroundColor: !activeTag ? color + '18' : '#f5f2ef',
                  color: !activeTag ? color : '#666',
                  fontSize: '0.8rem', fontWeight: !activeTag ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Все
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
                  style={{
                    padding: '3px 10px', borderRadius: '4px',
                    border: `1.5px solid ${activeTag === tag ? color : '#e0dbd5'}`,
                    backgroundColor: activeTag === tag ? color + '18' : '#f5f2ef',
                    color: activeTag === tag ? color : '#666',
                    fontSize: '0.8rem', fontWeight: activeTag === tag ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <p style={{ fontSize: '0.85rem', color: '#999', marginBottom: '1.1rem' }}>
        {filtered.length === 0
          ? 'Нет рецептов с такими фильтрами'
          : `${filtered.length} ${filtered.length === 1 ? 'рецепт' : filtered.length < 5 ? 'рецепта' : 'рецептов'}`}
      </p>

      {/* Recipe cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.1rem' }}>
        {filtered.map((recipe) => {
          const prepMin = parsePrepMinutes(recipe.prepTime)
          return (
            <Link
              key={recipe.slug}
              href={`/${recipe.category}/${recipe.slug}`}
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
            >
              <article style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: `1.5px solid ${color}33`,
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                height: '100%',
                display: 'flex', flexDirection: 'column',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
                  el.style.borderColor = color
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget
                  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'
                  el.style.borderColor = `${color}33`
                }}
              >
                {/* Hero */}
                <div style={{
                  height: '120px',
                  background: `linear-gradient(135deg, ${color}dd 0%, ${color}88 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '3rem',
                }}>
                  🍳
                </div>

                <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '0.97rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.4, marginBottom: '0.4rem' }}>
                    {recipe.title}
                  </h3>
                  <p style={{
                    fontSize: '0.83rem', color: '#666', lineHeight: 1.5, flex: 1,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    marginBottom: '0.75rem',
                  }}>
                    {recipe.description}
                  </p>

                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: '#888', flexWrap: 'wrap' }}>
                    {prepMin !== null && (
                      <span>⏱ {prepMin < 60 ? `${prepMin} мин` : `${Math.floor(prepMin / 60)} ч ${prepMin % 60 ? `${prepMin % 60} мин` : ''}`}</span>
                    )}
                    {recipe.recipeYield && <span>🍽 {recipe.recipeYield}</span>}
                    <span style={{ marginLeft: 'auto' }}>{relativeDate(recipe.date)}</span>
                  </div>

                  {recipe.tags.length > 0 && (
                    <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {recipe.tags.slice(0, 3).map((tag) => (
                        <span key={tag} style={{
                          fontSize: '0.7rem', color: '#aaa',
                          backgroundColor: '#f5f2ef', borderRadius: '3px', padding: '1px 5px',
                        }}>#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🍳</div>
          <p style={{ fontWeight: 600 }}>Нет рецептов с такими фильтрами</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.4rem' }}>
            Попробуйте убрать фильтры или{' '}
            <button
              onClick={() => { setTimeFilter('any'); setActiveTag('') }}
              style={{ background: 'none', border: 'none', color: color, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', padding: 0 }}
            >
              сбросить все
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
