'use client'

import { useCallback, useEffect, useState } from 'react'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase'

interface ArticleQuestionRow {
  id: string
  article_slug: string
  question: string
  status: 'pending' | 'approved' | 'rejected'
  answer: string | null
  created_at: string
  ip_hash: string | null
}

export default function AdminArticleQuestions() {
  const authState = useAdminAuth()
  const [rows, setRows] = useState<ArticleQuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sb = getSupabase()
      let query = sb.from('article_questions').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') {
        query = query.eq('status', filter)
      }
      const { data } = await query
      const items = (data as ArticleQuestionRow[]) || []
      setRows(items)
      const initialAnswers: Record<string, string> = {}
      items.forEach((item) => { if (item.id) initialAnswers[item.id] = item.answer || '' })
      setAnswers(initialAnswers)
    } catch { /* */ }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    if (authState !== 'authed') return
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [authState, load])

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const sb = getSupabase()
      await sb.from('article_questions').update({ status }).eq('id', id)
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
    } catch { /* */ }
  }

  const saveAnswer = async (id: string) => {
    if (saving[id]) return
    setSaving((prev) => ({ ...prev, [id]: true }))
    try {
      const sb = getSupabase()
      const answer = answers[id]?.trim() || null
      await sb.from('article_questions').update({ answer }).eq('id', id)
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, answer } : r))
    } catch { /* */ }
    setSaving((prev) => ({ ...prev, [id]: false }))
  }

  const formatDate = (value: string) => {
    try {
      const d = new Date(value)
      return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return value
    }
  }

  if (authState !== 'authed') return null

  return (
    <AdminShell activeNav="questions">
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Вопросы по статьям</h1>
        <p style={{ color: '#888', fontSize: '0.9rem', margin: '0.25rem 0 1.5rem' }}>
          Модерация вопросов читателей. Одобрите вопросы и ответьте на них, чтобы они появились на сайте.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem',
                border: filter === f ? '2px solid #c0392b' : '2px solid #e0dbd5',
                background: filter === f ? '#c0392b0f' : '#fff', color: filter === f ? '#c0392b' : '#555',
              }}>
              {f === 'all' ? 'Все' : f === 'pending' ? 'На проверке' : f === 'approved' ? 'Одобренные' : 'Отклонённые'}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#aaa' }}>Загрузка…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: '#999' }}>Нет вопросов в этой категории.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {rows.map((row) => (
              <div key={row.id} style={{ background: '#fff', border: '1px solid #e8e4df', borderRadius: '10px', padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#888', fontWeight: 600 }}>
                    {row.article_slug}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
                    padding: '0.2rem 0.6rem', borderRadius: '6px',
                    background: row.status === 'approved' ? '#e8f5e9' : row.status === 'rejected' ? '#ffebee' : '#fff8e1',
                    color: row.status === 'approved' ? '#1e8449' : row.status === 'rejected' ? '#c0392b' : '#b8860b',
                  }}>
                    {row.status === 'approved' ? 'Одобрено' : row.status === 'rejected' ? 'Отклонено' : 'На проверке'}
                  </div>
                </div>

                <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  {row.question}
                </div>

                <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: '0.75rem' }}>
                  {formatDate(row.created_at)} {row.ip_hash && `· ${row.ip_hash.slice(0, 12)}…`}
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <textarea
                    value={answers[row.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder="Ответ эксперта..."
                    style={{
                      width: '100%', minHeight: '80px', boxSizing: 'border-box', border: '1.5px solid #ddd',
                      borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontFamily: 'inherit',
                      resize: 'vertical', marginBottom: '0.5rem',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {row.status === 'pending' && (
                      <>
                        <button onClick={() => setStatus(row.id, 'approved')} style={btn('#27ae60')}>Одобрить</button>
                        <button onClick={() => setStatus(row.id, 'rejected')} style={btn('#c0392b')}>Отклонить</button>
                      </>
                    )}
                    {row.status === 'rejected' && (
                      <button onClick={() => setStatus(row.id, 'approved')} style={btn('#27ae60')}>Одобрить</button>
                    )}
                    {row.status === 'approved' && (
                      <button onClick={() => setStatus(row.id, 'rejected')} style={btn('#c0392b')}>Отклонить</button>
                    )}
                    <button onClick={() => saveAnswer(row.id)} disabled={saving[row.id]} style={btn('#3498db')}>
                      {saving[row.id] ? 'Сохраняем…' : 'Сохранить ответ'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  )
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '0.4rem 1rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
    background: color, color: '#fff', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit',
  }
}
