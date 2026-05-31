'use client'

import { useState, useMemo } from 'react'
import type { ArticleFrontmatter } from '@/lib/articles'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'

interface Props {
  articles: (ArticleFrontmatter & { wordCount: number })[]
}

type SortKey = 'date' | 'title' | 'category' | 'wordCount'
type SortDir = 'asc' | 'desc'

const SCHEMA_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  Recipe: { label: 'Recipe', color: '#9a3412', bg: '#fff7ed' },
  HowTo: { label: 'HowTo', color: '#1e40af', bg: '#eff6ff' },
}

const CATEGORY_LABELS: Record<string, string> = {
  kulinaria: 'Кулинария',
  'dom-i-uborka': 'Дом и уборка',
  'dacha-i-ogorod': 'Дача и огород',
  layfkhaki: 'Лайфхаки',
  ekonomiya: 'Экономия',
  rybalka: 'Рыбалка',
}

const CATEGORY_COLORS: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
  rybalka: '#2c7da0',
}

export default function AdminArticlesList({ articles }: Props) {
  const authState = useAdminAuth()
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterCategory, setFilterCategory] = useState('')

  const filtered = useMemo(() => {
    let list = [...articles]
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (CATEGORY_LABELS[a.category] || '').toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    if (filterCategory) {
      list = list.filter(a => a.category === filterCategory)
    }
    list.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      if (sortKey === 'date') { va = a.date; vb = b.date }
      else if (sortKey === 'title') { va = a.title.toLowerCase(); vb = b.title.toLowerCase() }
      else if (sortKey === 'category') { va = a.category; vb = b.category }
      else if (sortKey === 'wordCount') { va = a.wordCount; vb = b.wordCount }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [articles, query, sortKey, sortDir, filterCategory])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'date' || key === 'wordCount' ? 'desc' : 'asc') }
  }

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span style={{ color: '#ccc', marginLeft: '0.25rem' }}>↕</span>
    return <span style={{ color: '#c0392b', marginLeft: '0.25rem' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const categories = [...new Set(articles.map(a => a.category))].sort()

  if (authState !== 'authed') return null

  return (
    <AdminShell activeNav="articles">
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Статьи</h1>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
              {filtered.length} из {articles.length} статей
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          background: '#fff',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по заголовку, категории, тегу..."
            style={{
              flex: '1 1 220px',
              padding: '0.55rem 0.85rem',
              border: '1.5px solid #e5e7eb',
              borderRadius: '7px',
              fontSize: '0.9rem',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{
              padding: '0.55rem 0.85rem',
              border: '1.5px solid #e5e7eb',
              borderRadius: '7px',
              fontSize: '0.9rem',
              outline: 'none',
              fontFamily: 'inherit',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="">Все категории</option>
            {categories.map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
            ))}
          </select>
          {(query || filterCategory) && (
            <button
              onClick={() => { setQuery(''); setFilterCategory('') }}
              style={{
                padding: '0.55rem 0.85rem',
                border: '1px solid #e5e7eb',
                borderRadius: '7px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                background: '#f8f8f8',
                color: '#666',
                fontFamily: 'inherit',
              }}
            >
              Сбросить
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: '#f8f8f8', borderBottom: '2px solid #f0f0f0' }}>
                <th style={{ padding: '0.7rem 1rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '2.5rem' }}>#</th>
                <th
                  style={{ padding: '0.7rem 1rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('title')}
                >
                  Заголовок <SortIndicator col="title" />
                </th>
                <th
                  style={{ padding: '0.7rem 0.75rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('category')}
                >
                  Категория <SortIndicator col="category" />
                </th>
                <th
                  style={{ padding: '0.7rem 0.75rem', textAlign: 'center', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('date')}
                >
                  Дата <SortIndicator col="date" />
                </th>
                <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Теги</th>
                <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schema</th>
                <th
                  style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('wordCount')}
                >
                  Слов <SortIndicator col="wordCount" />
                </th>
                <th style={{ padding: '0.7rem 1rem', textAlign: 'right', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#bbb', fontSize: '0.95rem' }}>
                    Статьи не найдены
                  </td>
                </tr>
              )}
              {filtered.map((art, i) => {
                const badge = art.schemaType ? SCHEMA_BADGE[art.schemaType] : null
                const catColor = CATEGORY_COLORS[art.category] || '#888'
                return (
                  <tr
                    key={art.slug}
                    style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f0f0f0', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
                  >
                    <td style={{ padding: '0.7rem 1rem', color: '#bbb', fontSize: '0.78rem' }}>{i + 1}</td>
                    <td style={{ padding: '0.7rem 1rem', maxWidth: '260px' }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a', lineHeight: 1.35 }}>
                        <a href={`/admin/articles/${art.slug}/`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {art.title}
                        </a>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#aaa', marginTop: '0.1rem', fontFamily: 'monospace' }}>{art.slug}</div>
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: catColor,
                        background: catColor + '18',
                        whiteSpace: 'nowrap',
                      }}>
                        {CATEGORY_LABELS[art.category] || art.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center', color: '#666', whiteSpace: 'nowrap', fontSize: '0.83rem' }}>
                      {formatDate(art.date)}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', maxWidth: '160px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {art.tags.slice(0, 3).map(tag => (
                          <span key={tag} style={{
                            fontSize: '0.72rem',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background: '#f0ede8',
                            color: '#666',
                          }}>
                            #{tag}
                          </span>
                        ))}
                        {art.tags.length > 3 && (
                          <span style={{ fontSize: '0.72rem', color: '#aaa' }}>+{art.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center' }}>
                      {badge ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          color: badge.color,
                          background: badge.bg,
                        }}>
                          {badge.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.73rem', color: '#ccc', padding: '2px 7px', background: '#f8f8f8', borderRadius: '4px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: '#888', fontSize: '0.83rem' }}>
                      {art.wordCount.toLocaleString('ru-RU')}
                    </td>
                    <td style={{ padding: '0.7rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <a
                        href={`/${art.category}/${art.slug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.8rem',
                          color: '#c0392b',
                          textDecoration: 'none',
                          fontWeight: 600,
                          padding: '3px 8px',
                          border: '1px solid #f5c6c2',
                          borderRadius: '5px',
                          background: '#fff',
                        }}
                      >
                        Просмотр →
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  )
}
