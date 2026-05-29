'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const CATEGORIES = [
  { value: 'dom-i-remont', label: 'Дом и ремонт' },
  { value: 'sad-i-ogorod', label: 'Сад и огород' },
  { value: 'kulinariya', label: 'Кулинария' },
  { value: 'semya-i-byt', label: 'Семья и быт' },
  { value: 'zdorove', label: 'Здоровье' },
]

export default function NapisatPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('dom-i-remont')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (!u) { router.replace('/'); return }
      setUserId(u.id)
      setLoading(false)
    })
  }, [router])

  const submit = async (status: 'draft' | 'pending') => {
    if (!userId) return
    if (!title.trim()) { setError('Введите заголовок'); return }
    if (!content.trim()) { setError('Напишите текст статьи'); return }
    setError('')
    setSubmitting(true)

    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)

    const { error: err } = await supabase.from('user_articles').insert({
      user_id: userId,
      title: title.trim(),
      category,
      tags: tagList,
      content: content.trim(),
      status,
    })

    setSubmitting(false)
    if (err) { setError(err.message); return }
    setSuccess(status === 'draft' ? 'Черновик сохранён!' : 'Статья отправлена на проверку!')
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem', textAlign: 'center', color: '#aaa' }}>
        Загрузка…
      </div>
    )
  }

  if (success) {
    return (
      <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <div style={{
          background: '#e9f7ef', border: '1px solid #a9dfbf', borderRadius: '12px',
          padding: '2rem', marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <h2 style={{ color: '#27ae60', marginBottom: '0.5rem', fontSize: '1.2rem' }}>{success}</h2>
          <p style={{ color: '#555', fontSize: '0.93rem', margin: 0 }}>
            Вы можете следить за статусом в своём кабинете.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link
            href="/moy-kabinet/"
            style={{
              backgroundColor: '#c0392b', color: '#fff', textDecoration: 'none',
              borderRadius: '7px', padding: '0.6rem 1.2rem', fontWeight: 700, fontSize: '0.9rem',
            }}
          >
            Мой кабинет
          </Link>
          <button
            onClick={() => { setSuccess(null); setTitle(''); setContent(''); setTags('') }}
            style={{
              background: 'none', border: '1.5px solid #ddd', borderRadius: '7px',
              padding: '0.6rem 1.2rem', fontSize: '0.9rem', cursor: 'pointer', color: '#555',
            }}
          >
            Написать ещё
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          Написать статью
        </h1>
        <button
          onClick={() => setPreview((p) => !p)}
          style={{
            background: 'none', border: '1.5px solid #c0392b', borderRadius: '7px',
            padding: '0.45rem 1rem', fontSize: '0.85rem', color: '#c0392b',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          {preview ? '✏️ Редактор' : '👁 Предпросмотр'}
        </button>
      </div>

      {preview ? (
        <div style={{
          background: '#fff', border: '1px solid #e8e4df', borderRadius: '12px',
          padding: '2rem', minHeight: '300px',
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>{title || '(без заголовка)'}</h2>
          <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: '1.5rem' }}>
            {CATEGORIES.find((c) => c.value === category)?.label}
            {tags && ` · ${tags.split(',').map((t) => `#${t.trim()}`).join(' ')}`}
          </div>
          <div style={{ lineHeight: 1.75, fontSize: '0.97rem', color: '#333', whiteSpace: 'pre-wrap' }}>
            {content || <span style={{ color: '#ccc' }}>(нет текста)</span>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={labelStyle}>Заголовок *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Как вырастить помидоры на балконе"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Категория *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ ...inputStyle, backgroundColor: '#fff' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Теги (через запятую)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="уход, рассада, дача"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Текст статьи * (поддерживается Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              placeholder="## Введение&#10;&#10;Напишите здесь вашу статью…"
              style={{
                ...inputStyle, resize: 'vertical', fontFamily: 'monospace',
                fontSize: '0.9rem', lineHeight: 1.6,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <p style={{ color: '#c0392b', fontSize: '0.88rem', margin: '0.75rem 0 0' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => submit('draft')}
          disabled={submitting}
          style={{
            background: 'none', border: '1.5px solid #888', borderRadius: '7px',
            padding: '0.6rem 1.2rem', fontSize: '0.9rem', color: '#555',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          {submitting ? '…' : '💾 Сохранить черновик'}
        </button>
        <button
          onClick={() => submit('pending')}
          disabled={submitting}
          style={{
            backgroundColor: '#c0392b', color: '#fff', border: 'none',
            borderRadius: '7px', padding: '0.6rem 1.4rem',
            fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          {submitting ? 'Отправляем…' : '🚀 Отправить на проверку'}
        </button>
      </div>

      <p style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '0.75rem' }}>
        После отправки статья пройдёт модерацию и будет опубликована в течение 1–3 дней.
      </p>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.8rem', borderRadius: '7px',
  border: '1.5px solid #ddd', fontSize: '0.93rem', outline: 'none',
  boxSizing: 'border-box', lineHeight: 1.5,
}
