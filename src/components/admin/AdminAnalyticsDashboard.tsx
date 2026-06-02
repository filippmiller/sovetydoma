'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase'

const ANALYTICS_WORKER = (
  process.env.NEXT_PUBLIC_ANALYTICS_WORKER_URL
  || process.env.NEXT_PUBLIC_VIEW_WORKER_URL
  || process.env.NEXT_PUBLIC_CONTACT_WORKER_URL
  || process.env.NEXT_PUBLIC_PHOTO_WORKER_URL
  || ''
).replace(/\/+$/, '')

type SummaryRow = Record<string, string | number | null>

type AnalyticsPayload = {
  days: number
  summary: {
    sessions_total: number
    sessions_human: number
    sessions_bot: number
    pageviews_human: number
    avg_session_seconds: number
    bounce_rate: number
    top_pages: SummaryRow[]
    referrers: SummaryRow[]
    paths: SummaryRow[]
    countries: SummaryRow[]
    daily: SummaryRow[]
  }
  sessions: SummaryRow[]
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0 с'
  if (seconds < 60) return `${seconds} с`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return rest ? `${minutes} мин ${rest} с` : `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  return `${hours} ч ${minutes % 60} мин`
}

function formatDate(value: string | number | null): string {
  if (!value) return '—'
  return new Date(String(value)).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8e4df',
      borderRadius: '10px',
      padding: '1rem 1.1rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ color: '#888', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ color: '#1a1a1a', fontSize: '1.8rem', lineHeight: 1.15, fontWeight: 850, marginTop: '0.35rem' }}>
        {value}
      </div>
      {hint && <div style={{ color: '#999', fontSize: '0.82rem', marginTop: '0.25rem' }}>{hint}</div>}
    </div>
  )
}

function DataTable({
  title,
  columns,
  rows,
}: {
  title: string
  columns: { key: string; label: string; render?: (row: SummaryRow) => string | number }[]
  rows: SummaryRow[]
}) {
  return (
    <section style={{ background: '#fff', border: '1px solid #e8e4df', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '1rem 1.1rem', borderBottom: '1px solid #f0ede8', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1a1a1a' }}>{title}</h2>
        <span style={{ color: '#aaa', fontSize: '0.8rem' }}>{rows.length}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ background: '#faf8f5' }}>
              {columns.map((column) => (
                <th key={column.key} style={{ padding: '0.65rem 0.85rem', textAlign: 'left', color: '#777', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '1rem', color: '#999', textAlign: 'center' }}>Пока нет данных</td>
              </tr>
            ) : rows.map((row, index) => (
              <tr key={index} style={{ borderTop: '1px solid #f4f0ec' }}>
                {columns.map((column) => (
                  <td key={column.key} style={{ padding: '0.65rem 0.85rem', color: '#333', verticalAlign: 'top' }}>
                    {column.render ? column.render(row) : String(row[column.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function AdminAnalyticsDashboard() {
  const authState = useAdminAuth()
  const [days, setDays] = useState(7)
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authState !== 'authed') return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        if (!ANALYTICS_WORKER) throw new Error('Analytics worker is not configured')
        const { data: sessionData } = await getSupabase().auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) throw new Error('No admin session')
        const res = await fetch(`${ANALYTICS_WORKER}/analytics/summary?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Analytics API returned ${res.status}`)
        const payload = await res.json() as AnalyticsPayload
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить аналитику')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authState, days])

  const summary = data?.summary
  const botShare = useMemo(() => {
    if (!summary?.sessions_total) return '0%'
    return `${Math.round((summary.sessions_bot / summary.sessions_total) * 100)}%`
  }, [summary])

  if (authState !== 'authed') return null

  return (
    <AdminShell activeNav="analytics">
      <div style={{ padding: '2rem', display: 'grid', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 850, color: '#1a1a1a' }}>Аналитика посещений</h1>
            <p style={{ margin: '0.25rem 0 0', color: '#888', fontSize: '0.9rem' }}>
              Люди, боты, источники, страницы входа и выхода. IP-адреса не сохраняются.
            </p>
          </div>
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            style={{ height: 38, borderRadius: 7, border: '1px solid #ddd', padding: '0 0.7rem', background: '#fff', font: 'inherit' }}
          >
            <option value={1}>24 часа</option>
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
          </select>
        </div>

        {error && (
          <div style={{ border: '1px solid #f0b8b0', background: '#fff4f2', color: '#a4382d', borderRadius: 8, padding: '0.9rem 1rem' }}>
            {error}
          </div>
        )}

        {loading && !data ? (
          <div style={{ color: '#888', padding: '2rem', background: '#fff', borderRadius: 10 }}>Загружаем аналитику…</div>
        ) : summary ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.9rem' }}>
              <StatCard label="Люди" value={summary.sessions_human} hint="human + likely human" />
              <StatCard label="Боты" value={summary.sessions_bot} hint={botShare} />
              <StatCard label="Просмотры" value={summary.pageviews_human} hint="страницы людей" />
              <StatCard label="Среднее время" value={formatDuration(summary.avg_session_seconds)} />
              <StatCard label="Bounce rate" value={`${summary.bounce_rate}%`} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: '1rem' }}>
              <DataTable
                title="Топ страниц"
                rows={summary.top_pages || []}
                columns={[
                  { key: 'path', label: 'Страница' },
                  { key: 'views', label: 'Просмотры' },
                  { key: 'sessions', label: 'Сессии' },
                  { key: 'avg_duration_seconds', label: 'Время', render: (row) => formatDuration(Number(row.avg_duration_seconds || 0)) },
                ]}
              />
              <DataTable
                title="Источники"
                rows={summary.referrers || []}
                columns={[
                  { key: 'source', label: 'Источник' },
                  { key: 'sessions', label: 'Сессии' },
                ]}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 0.7fr)', gap: '1rem' }}>
              <DataTable
                title="Карта входа и выхода"
                rows={summary.paths || []}
                columns={[
                  { key: 'landing_path', label: 'Вход' },
                  { key: 'exit_path', label: 'Выход' },
                  { key: 'sessions', label: 'Сессии' },
                ]}
              />
              <DataTable
                title="Страны"
                rows={summary.countries || []}
                columns={[
                  { key: 'country', label: 'Страна' },
                  { key: 'sessions', label: 'Сессии' },
                ]}
              />
            </div>

            <DataTable
              title="Последние сессии"
              rows={data?.sessions || []}
              columns={[
                { key: 'started_at', label: 'Старт', render: (row) => formatDate(row.started_at) },
                { key: 'classification', label: 'Тип' },
                { key: 'landing_path', label: 'Вход' },
                { key: 'exit_path', label: 'Выход' },
                { key: 'referrer_domain', label: 'Источник', render: (row) => String(row.referrer_domain || 'direct') },
                { key: 'page_count', label: 'Страниц' },
                { key: 'total_duration_seconds', label: 'Время', render: (row) => formatDuration(Number(row.total_duration_seconds || 0)) },
                { key: 'device_type', label: 'Устройство' },
              ]}
            />
          </>
        ) : null}
      </div>
    </AdminShell>
  )
}
