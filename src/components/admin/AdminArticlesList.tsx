'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'
import {
  AdminApiError,
  listArticles,
  type AdminArticleListItem,
  type AdminTextStatus,
} from '@/lib/admin-api'
import { SUBSCRIPTION_CATEGORY_SLUGS } from '@/lib/subscriptions/constants.mjs'
import { CATEGORIES } from '@/lib/categories'

const PER_PAGE = 50
const SEARCH_DEBOUNCE_MS = 350

const CATEGORY_SLUGS: string[] = SUBSCRIPTION_CATEGORY_SLUGS

const STATUS_OPTIONS: { value: '' | AdminTextStatus; label: string }[] = [
  { value: '', label: 'Все статусы' },
  { value: 'idea', label: 'Идея' },
  { value: 'draft', label: 'Черновик' },
  { value: 'reviewed', label: 'Проверен' },
  { value: 'approved', label: 'Одобрен' },
  { value: 'published', label: 'Опубликован' },
  { value: 'unpublished', label: 'Снят с публикации' },
  { value: 'scheduled', label: 'Запланирован' },
]

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  idea: { label: 'Идея', color: '#6b7280', bg: '#f3f4f6' },
  draft: { label: 'Черновик', color: '#9a3412', bg: '#fff7ed' },
  reviewed: { label: 'Проверен', color: '#1e40af', bg: '#eff6ff' },
  approved: { label: 'Одобрен', color: '#166534', bg: '#f0fdf4' },
  published: { label: 'Опубликован', color: '#15803d', bg: '#dcfce7' },
  unpublished: { label: 'Снят', color: '#b91c1c', bg: '#fee2e2' },
  scheduled: { label: 'Запланирован', color: '#7e22ce', bg: '#faf5ff' },
}

const CATEGORY_COLORS: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
  rybalka: '#2c7da0',
  'zdorovie-i-bezopasnost': '#c0392b',
  'semya-i-deti': '#8e44ad',
  'krasota-i-uhod': '#e91e63',
  'otdyh-i-puteshestviya': '#2980b9',
  'pokupki-i-tehnika': '#f39c12',
  avto: '#34495e',
}

function categoryLabel(slug: string): string {
  return CATEGORIES[slug]?.name || slug
}

function formatDate(d: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface LoadState {
  status: 'loading' | 'ready' | 'error'
  items: AdminArticleListItem[]
  page: number
  total: number
  error: string | null
}

export default function AdminArticlesList() {
  const authState = useAdminAuth()
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [sortCol, setSortCol] = useState<'updated_at' | 'title' | 'created_at' | 'published_at'>('updated_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading', items: [], page: 1, total: 0, error: null })

  // Debounce the search box before it hits the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  function toggleSort(col: 'updated_at' | 'title' | 'created_at' | 'published_at') {
    if (sortCol === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'title' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const sortParam = `${sortCol}.${sortDir}`

  const load = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading', error: null }))
    try {
      const res = await listArticles({ page, per_page: PER_PAGE, status, category, q: debouncedQuery, sort: sortParam })
      setState({ status: 'ready', items: res.items, page: res.page, total: res.total, error: null })
    } catch (e) {
      const msg = e instanceof AdminApiError
        ? `${e.message} (${e.code}${e.status ? `, HTTP ${e.status}` : ''})`
        : e instanceof Error ? e.message : 'Неизвестная ошибка'
      console.error('[AdminArticlesList] load failed', e)
      setState(s => ({ ...s, status: 'error', error: msg }))
    }
  }, [page, status, category, debouncedQuery, sortParam])

  useEffect(() => {
    if (authState !== 'authed') return
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [authState, load, reloadNonce])

  if (authState !== 'authed') return null

  const totalPages = Math.max(1, Math.ceil(state.total / PER_PAGE))

  return (
    <AdminShell activeNav="articles">
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Статьи</h1>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
              {state.status === 'ready' ? `Всего: ${state.total} · страница ${state.page} из ${totalPages}` : 'Загрузка из admin-api...'}
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
            placeholder="Поиск по заголовку или slug..."
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
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
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
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1) }}
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
            {CATEGORY_SLUGS.map(c => (
              <option key={c} value={c}>{categoryLabel(c)}</option>
            ))}
          </select>
          {(query || status || category) && (
            <button
              onClick={() => { setQuery(''); setStatus(''); setCategory(''); setPage(1) }}
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

        {/* Error state */}
        {state.status === 'error' && (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: '2.5rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '0.25rem' }}>Не удалось загрузить статьи</div>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>{state.error}</div>
            <button
              onClick={() => setReloadNonce(n => n + 1)}
              style={{
                padding: '0.55rem 1.25rem',
                background: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                fontSize: '0.88rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
              }}
            >
              Повторить
            </button>
          </div>
        )}

        {/* Loading state */}
        {state.status === 'loading' && (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: '3rem',
            textAlign: 'center',
            color: '#aaa',
            fontSize: '0.95rem',
          }}>
            Загрузка...
          </div>
        )}

        {/* Table */}
        {state.status === 'ready' && (
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            overflow: 'auto',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem', minWidth: '760px' }}>
              <thead>
                <tr style={{ background: '#f8f8f8', borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '2.5rem' }}>#</th>
                  <th
                    role="columnheader"
                    aria-sort={sortCol === 'title' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => toggleSort('title')}
                    style={{ padding: '0.7rem 1rem', textAlign: 'left', color: sortCol === 'title' ? '#c0392b' : '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none' }}
                    title="Сортировать по заголовку"
                  >
                    Заголовок {sortCol === 'title' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Категория</th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Статус</th>
                  <th
                    role="columnheader"
                    aria-sort={sortCol === 'updated_at' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    onClick={() => toggleSort('updated_at')}
                    style={{ padding: '0.7rem 0.75rem', textAlign: 'center', color: sortCol === 'updated_at' ? '#c0392b' : '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
                    title="Сортировать по дате обновления"
                  >
                    Обновлено {sortCol === 'updated_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th style={{ padding: '0.7rem 0.75rem', textAlign: 'center', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Рев.</th>
                  <th style={{ padding: '0.7rem 1rem', textAlign: 'right', color: '#888', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}></th>
                </tr>
              </thead>
              <tbody>
                {state.items.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#bbb', fontSize: '0.95rem' }}>
                      Статьи не найдены
                    </td>
                  </tr>
                )}
                {state.items.map((art, i) => {
                  const badge = STATUS_BADGE[art.text_status] || { label: art.text_status, color: '#666', bg: '#f3f4f6' }
                  const catColor = CATEGORY_COLORS[art.category] || '#888'
                  return (
                    <tr
                      key={art.id}
                      style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f0f0f0', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f0f4ff')}
                      onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
                    >
                      <td style={{ padding: '0.7rem 1rem', color: '#bbb', fontSize: '0.78rem' }}>{(state.page - 1) * PER_PAGE + i + 1}</td>
                      <td style={{ padding: '0.7rem 1rem', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 600, color: '#1a1a1a', lineHeight: 1.35 }}>
                          <Link href={`/admin/article/?id=${encodeURIComponent(art.id)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {art.title}
                          </Link>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#aaa', marginTop: '0.1rem', fontFamily: 'monospace' }}>{art.slug}</div>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          {art.disposition && (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: '#eef2ff',
                              color: '#4338ca',
                              fontWeight: 600,
                            }}>
                              {art.disposition}
                            </span>
                          )}
                          {art.published_via && (
                            <span style={{
                              fontSize: '0.72rem',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              background: '#fff7ed',
                              color: '#9a3412',
                              fontWeight: 600,
                            }}
                              title="Опубликовано без пересборки сайта"
                            >
                              ⚡ {art.published_via}
                            </span>
                          )}
                        </div>
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
                          {categoryLabel(art.category)}
                        </span>
                      </td>
                      <td style={{ padding: '0.7rem 0.75rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          color: badge.color,
                          background: badge.bg,
                          whiteSpace: 'nowrap',
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center', color: '#666', whiteSpace: 'nowrap', fontSize: '0.83rem' }}>
                        {formatDate(art.updated_at)}
                      </td>
                      <td style={{ padding: '0.7rem 0.75rem', textAlign: 'center', color: '#888', fontSize: '0.83rem' }}>
                        {art.revision_count ?? 0}
                      </td>
                      <td style={{ padding: '0.7rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Link
                          href={`/admin/article/?id=${encodeURIComponent(art.id)}`}
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
                          Редактировать →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                padding: '0.9rem 1rem',
                borderTop: '1px solid #f0f0f0',
                background: '#fafafa',
              }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={state.page <= 1}
                  style={{
                    padding: '0.4rem 0.9rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: state.page <= 1 ? 'default' : 'pointer',
                    background: '#fff',
                    color: state.page <= 1 ? '#ccc' : '#444',
                    fontFamily: 'inherit',
                  }}
                >
                  ← Назад
                </button>
                <span style={{ fontSize: '0.85rem', color: '#888' }}>
                  Стр. {state.page} из {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={state.page >= totalPages}
                  style={{
                    padding: '0.4rem 0.9rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: state.page >= totalPages ? 'default' : 'pointer',
                    background: '#fff',
                    color: state.page >= totalPages ? '#ccc' : '#444',
                    fontFamily: 'inherit',
                  }}
                >
                  Вперёд →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  )
}
