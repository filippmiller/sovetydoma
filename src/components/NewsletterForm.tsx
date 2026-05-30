'use client'

import { useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidEmail) return
    setLoading(true)
    setSuccess(null)
    setError(null)
    try {
      // Static export has no API routes — write straight to Supabase.
      const sb = getSupabase()
      const { error: err } = await sb
        .from('newsletter_subscribers')
        .insert({ email: email.trim().toLowerCase() })
      if (!err) {
        setSuccess('Вы подписаны! Спасибо.')
        setEmail('')
      } else if (err.code === '23505') {
        // unique_violation — already subscribed
        setSuccess('Вы уже подписаны 🙂')
        setEmail('')
      } else {
        setError('Ошибка подписки. Попробуйте позже.')
      }
    } catch {
      setError('Сервис временно недоступен')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.4rem' }}>
        <input
          type="email"
          placeholder="Ваш email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          style={{
            flex: 1, padding: '0.5rem 0.75rem', borderRadius: '5px',
            border: '1px solid #444', background: '#3a3a3a',
            color: '#eee', fontSize: '0.83rem', outline: 'none', minWidth: 0,
          }}
        />
        <button
          type="submit"
          disabled={!isValidEmail || loading}
          style={{
            background: '#c0392b', color: '#fff', border: 'none',
            borderRadius: '5px', padding: '0.5rem 0.75rem',
            fontSize: '0.83rem', cursor: isValidEmail && !loading ? 'pointer' : 'not-allowed',
            fontWeight: 600, whiteSpace: 'nowrap',
            opacity: isValidEmail && !loading ? 1 : 0.6,
          }}
        >
          {loading ? 'Отправка...' : 'Подписаться'}
        </button>
      </form>
      {success && (
        <p style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#4caf50' }}>{success}</p>
      )}
      {error && (
        <p style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#e57373' }}>{error}</p>
      )}
    </div>
  )
}
