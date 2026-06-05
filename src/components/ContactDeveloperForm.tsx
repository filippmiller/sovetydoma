'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'

type Challenge = {
  token: string
  expiresAt: number
}

const endpoint = (process.env.NEXT_PUBLIC_CONTACT_WORKER_URL || process.env.NEXT_PUBLIC_PHOTO_WORKER_URL || '').replace(/\/+$/, '')

const TOPICS = [
  'Вопрос по статье',
  'Ошибка в материале',
  'Реклама и партнёрство',
  'Предложить тему',
  'Другое',
]
const DEFAULT_TOPIC = TOPICS[0]
const ADVERTISING_TOPIC = TOPICS[2]

export default function ContactDeveloperForm({ initialTopic }: { initialTopic?: string }) {
  const searchParams = useSearchParams()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [startedAt] = useState(() => Date.now())
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [selectedTopic, setSelectedTopic] = useState<string>(() => {
    const topicParam = searchParams.get('topic')
    if (topicParam === 'advertising' || topicParam === 'advert') return ADVERTISING_TOPIC
    if (initialTopic && TOPICS.includes(initialTopic)) return initialTopic
    return DEFAULT_TOPIC
  })

  const canUseForm = useMemo(() => endpoint.length > 0, [])

  useEffect(() => {
    if (!canUseForm) return
    let active = true

    fetch(`${endpoint}/contact/challenge`, { method: 'GET' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('challenge_failed'))))
      .then((data: Challenge) => {
        if (active) setChallenge(data)
      })
      .catch(() => {
        if (active) setMessage('Форма временно недоступна. Напишите напрямую на email ниже.')
      })

    return () => {
      active = false
    }
  }, [canUseForm])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canUseForm || !challenge) return

    const form = new FormData(event.currentTarget)
    setStatus('loading')
    setMessage('')

    try {
      const topic = selectedTopic
      const rawSubject = String(form.get('subject') || '')
      const subject = rawSubject ? `[${topic}] ${rawSubject}` : `[${topic}] Без уточнения`

      const res = await fetch(`${endpoint}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: challenge.token,
          startedAt,
          name: String(form.get('name') || ''),
          email: String(form.get('email') || ''),
          subject,
          body: String(form.get('body') || ''),
          website: String(form.get('website') || ''),
          topic, // extra, worker may ignore if not expected
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'send_failed')

      setStatus('sent')
      setMessage('Сообщение отправлено разработчику.')
      event.currentTarget.reset()
    } catch {
      setStatus('error')
      setMessage('Не удалось отправить форму. Напишите напрямую на email ниже.')
    }
  }

  return (
    <div style={{ border: '1px solid #e7ded6', borderRadius: '8px', padding: '1.25rem', background: '#fffdf9' }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: '0.9rem' }}>
        <div style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
          <label>
            Ваш сайт
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700, color: '#333' }}>
          Имя
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700, color: '#333' }}>
          Email для ответа
          <input
            name="email"
            type="email"
            required
            maxLength={120}
            autoComplete="email"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700, color: '#333' }}>
          Тема обращения
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            style={inputStyle}
            aria-label="Тема обращения"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.78rem', color: '#777', fontWeight: 400 }}>
            При выборе «Реклама и партнёрство» тема подставится автоматически.
          </span>
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700, color: '#333' }}>
          Уточнение темы (необязательно)
          <input
            name="subject"
            minLength={0}
            maxLength={120}
            placeholder="Коротко о чём (например: ошибка в расчётах или предложение по кешбэку)"
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem', fontWeight: 700, color: '#333' }}>
          Сообщение
          <textarea
            name="body"
            required
            minLength={20}
            maxLength={4000}
            rows={7}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </label>

        <button
          type="submit"
          disabled={!canUseForm || !challenge || status === 'loading' || status === 'sent'}
          style={{
            minHeight: '44px',
            border: 'none',
            borderRadius: '6px',
            background: !canUseForm || !challenge ? '#bbb' : '#c0392b',
            color: '#fff',
            fontWeight: 800,
            cursor: !canUseForm || !challenge ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'loading' ? 'Отправляем...' : 'Отправить сообщение'}
        </button>

        {message && (
          <p role="status" style={{ margin: 0, color: status === 'sent' ? '#267a3f' : '#9a4b12', fontSize: '0.9rem' }}>
            {message}
          </p>
        )}
      </form>

      <p style={{ margin: '1rem 0 0', color: '#666', fontSize: '0.9rem', lineHeight: 1.6 }}>
        Прямая почта: <a href="mailto:alexmiller.idothings@gmail.com" style={{ color: '#c0392b', fontWeight: 700 }}>alexmiller.idothings@gmail.com</a>
      </p>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #d8d0c8',
  borderRadius: '6px',
  padding: '0.7rem 0.75rem',
  font: 'inherit',
  background: '#fff',
  color: '#222',
  boxSizing: 'border-box',
}
