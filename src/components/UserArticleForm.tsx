'use client'

// UserArticleForm is used by /napisat/ page.
// This file re-exports the page logic as a standalone form component
// for embedding elsewhere if needed.

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Values MUST match the user_articles.category check constraint.
const CATEGORIES = [
  { value: 'kulinaria', label: 'Кулинария' },
  { value: 'dom-i-uborka', label: 'Дом и уборка' },
  { value: 'dacha-i-ogorod', label: 'Дача и огород' },
  { value: 'layfkhaki', label: 'Лайфхаки' },
  { value: 'ekonomiya', label: 'Экономия' },
]

interface Props {
  userId: string
  onSuccess: (status: 'draft' | 'pending') => void
}

export default function UserArticleForm({ userId, onSuccess }: Props) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('kulinaria')
  const [tags, setTags] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (status: 'draft' | 'pending') => {
    if (!title.trim()) { setError('Введите заголовок'); return }
    if (!content.trim()) { setError('Напишите текст статьи'); return }
    setError('')
    setSubmitting(true)

    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)

    const { error: err } = await supabase.from('user_articles').insert({
      author_id: userId,
      title: title.trim(),
      category,
      tags: tagList,
      content: content.trim(),
      status,
    })

    setSubmitting(false)
    if (err) { setError(err.message); return }
    onSuccess(status)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <label style={labelStyle}>Заголовок *</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>Категория *</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, backgroundColor: '#fff' }}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Теги (через запятую)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Текст статьи *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.6 }}
        />
      </div>

      {error && <p style={{ color: '#c0392b', fontSize: '0.88rem', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={() => submit('draft')}
          disabled={submitting}
          style={{ background: 'none', border: '1.5px solid #888', borderRadius: '7px', padding: '0.6rem 1.2rem', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600, color: '#555' }}
        >
          💾 Черновик
        </button>
        <button
          onClick={() => submit('pending')}
          disabled={submitting}
          style={{ backgroundColor: '#c0392b', color: '#fff', border: 'none', borderRadius: '7px', padding: '0.6rem 1.4rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
        >
          {submitting ? 'Отправляем…' : '🚀 На проверку'}
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.8rem', borderRadius: '7px',
  border: '1.5px solid #ddd', fontSize: '0.93rem', outline: 'none', boxSizing: 'border-box',
}
