'use client'

import { useState, useCallback } from 'react'

const ACCENT = '#c0392b'
const CATEGORIES = [
  { slug: 'kulinaria', name: 'Кулинария' },
  { slug: 'dom-i-uborka', name: 'Дом и уборка' },
  { slug: 'dacha-i-ogorod', name: 'Дача и огород' },
  { slug: 'layfkhaki', name: 'Лайфхаки' },
  { slug: 'ekonomiya', name: 'Экономия' },
  { slug: 'rybalka', name: 'Рыбалка' },
  { slug: 'zdorovie-i-bezopasnost', name: 'Здоровье и безопасность' },
  { slug: 'semya-i-deti', name: 'Семья и дети' },
  { slug: 'krasota-i-uhod', name: 'Красота и уход' },
  { slug: 'otdyh-i-puteshestviya', name: 'Отдых и путешествия' },
  { slug: 'pokupki-i-tehnika', name: 'Покупки и техника' },
  { slug: 'avto', name: 'Авто' },
]

export default function AdminPushNotifications() {
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; removed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || 'https://sovetydoma-subscriptions.filippmiller.workers.dev'
      const res = await fetch(`${apiUrl}/admin/push/fan-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
        },
        body: JSON.stringify({ category, title, body, url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'fan_out_failed')
      }
      setResult({ sent: data.sent || 0, failed: data.failed || 0, removed: data.removed || 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'fan_out_failed')
    } finally {
      setLoading(false)
    }
  }, [category, title, body, url, adminKey])

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>📲 Push-уведомления</h1>

      <div style={{
        background: '#fff',
        borderRadius: '8px',
        padding: '1.5rem',
        maxWidth: '640px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' }}>
              Категория
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
              }}
            >
              <option value="">Выберите категорию</option>
              {CATEGORIES.map(cat => (
                <option key={cat.slug} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' }}>
              Заголовок
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="Новая статья на 1001sovet.ru"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' }}>
              Текст уведомления
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              maxLength={240}
              rows={3}
              placeholder="Краткое описание новой статьи..."
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' }}>
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              placeholder="https://1001sovet.ru/ekonomiya/novaya-statya/"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.35rem' }}>
              Admin API Key
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={e => setAdminKey(e.target.value)}
              required
              placeholder="x-admin-key"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: '6px',
              border: 'none',
              background: ACCENT,
              color: '#fff',
              fontSize: '0.95rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Отправка...' : 'Отправить push-уведомления'}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '6px', background: '#fff0f0', color: ACCENT, fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '6px', background: '#f0fff4', color: '#276749', fontSize: '0.85rem' }}>
            Отправлено: <strong>{result.sent}</strong> · Ошибок: <strong>{result.failed}</strong> · Удалено: <strong>{result.removed}</strong>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', maxWidth: '640px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Как это работает</h2>
        <ol style={{ fontSize: '0.85rem', color: '#555', lineHeight: 1.6, paddingLeft: '1.25rem' }}>
          <li>Пользователь нажимает «🔔 Уведомлять о новых статьях» на странице категории или статьи.</li>
          <li>Браузер запрашивает разрешение и создаёт push-подписку через Service Worker.</li>
          <li>Данные подписки (endpoint, p256dh, auth) сохраняются в таблице <code>push_subscriptions</code> в Supabase.</li>
          <li>Админ выбирает категорию, пишет заголовок и текст, и отправляет уведомление всем подписчикам этой категории.</li>
          <li>Устаревшие или недействительные подписки (410 Gone) автоматически удаляются.</li>
        </ol>
      </div>
    </div>
  )
}
