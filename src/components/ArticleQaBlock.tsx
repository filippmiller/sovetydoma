'use client'

import { useEffect, useState } from 'react'
import TurnstileWidget from '@/components/TurnstileWidget'
import { formatDate } from '@/lib/utils'

interface Props {
  articleSlug: string
}

interface ArticleQuestion {
  id: string
  article_slug: string
  question: string
  answer: string | null
  created_at: string
}

const PHOTO_WORKER = (
  process.env.NEXT_PUBLIC_PHOTO_WORKER_URL
  || 'https://sovetydoma-photo-upload.filippmiller.workers.dev'
).replace(/\/+$/, '')

export default function ArticleQaBlock({ articleSlug }: Props) {
  const [questions, setQuestions] = useState<ArticleQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [questionText, setQuestionText] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchQuestions() {
      if (!PHOTO_WORKER) return
      try {
        const res = await fetch(`${PHOTO_WORKER}/article-questions?article_slug=${encodeURIComponent(articleSlug)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) throw new Error('fetch_failed')
        const data = (await res.json()) as { questions: ArticleQuestion[] }
        if (!cancelled) setQuestions(data.questions || [])
      } catch {
        if (!cancelled) setQuestions([])
      }
      if (!cancelled) setLoading(false)
    }
    fetchQuestions()
    return () => { cancelled = true }
  }, [articleSlug])

  const submit = async () => {
    if (questionText.trim().length < 1) {
      setError('Вопрос слишком короткий')
      return
    }
    if (questionText.trim().length > 500) {
      setError('Вопрос слишком длинный (максимум 500 символов)')
      return
    }
    if (!turnstileToken) {
      setError('Пройдите проверку безопасности')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${PHOTO_WORKER}/article-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_slug: articleSlug,
          question: questionText.trim(),
          turnstileToken,
        }),
      })
      const data = await res.json().catch(() => ({})) as { success?: boolean; error?: string }
      if (!res.ok || !data.success) {
        const errMsg = data.error === 'rate_limited'
          ? 'Слишком много вопросов. Подождите немного.'
          : data.error === 'turnstile_failed'
            ? 'Проверка безопасности не пройдена. Попробуйте ещё раз.'
            : 'Не удалось отправить вопрос. Попробуйте позже.'
        setError(errMsg)
        setSubmitting(false)
        return
      }
      setSubmitted(true)
      setQuestionText('')
      setTurnstileToken('')
    } catch {
      setError('Сервис временно недоступен')
    }
    setSubmitting(false)
  }

  return (
    <section style={{ marginTop: '2.5rem', borderTop: '1px solid #f0ece7', paddingTop: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a' }}>💬 Вопросы и ответы</h2>
        <button
          onClick={() => setOpen(v => !v)}
          style={{
            padding: '0.45rem 1.1rem', borderRadius: '8px', border: 'none',
            background: '#c0392b', color: '#fff', fontSize: '0.85rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {open ? 'Скрыть форму' : 'Задать вопрос'}
        </button>
      </div>

      {/* Ask form */}
      {open && (
        <div style={{ background: '#fff', border: '1.5px solid #ede9e4', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            maxLength={500}
            placeholder="Есть вопрос по теме? Напишите здесь..."
            style={{
              width: '100%', minHeight: '100px', boxSizing: 'border-box', border: '1.5px solid #ddd',
              borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.95rem', fontFamily: 'inherit',
              resize: 'vertical', marginBottom: '0.75rem',
            }}
          />
          <div style={{ fontSize: '0.78rem', color: '#999', marginBottom: '0.75rem', textAlign: 'right' }}>
            {questionText.length} / 500
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <TurnstileWidget onToken={setTurnstileToken} />
          </div>

          {error && <p style={{ color: '#c0392b', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.6rem' }}>
            <button
              onClick={() => { setOpen(false); setError('') }}
              style={{ background: 'none', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', color: '#777', fontFamily: 'inherit' }}
            >
              Отмена
            </button>
            <button
              onClick={submit}
              disabled={submitting || !turnstileToken}
              style={{
                background: '#c0392b', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1.3rem',
                fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting || !turnstileToken ? 0.6 : 1,
              }}
            >
              {submitting ? 'Отправляем…' : 'Отправить'}
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <div style={{
          background: '#f0fff4', border: '1.5px solid #b2dfdb', borderRadius: '10px', padding: '0.9rem 1.1rem',
          marginBottom: '1.25rem', color: '#1e8449', fontSize: '0.9rem',
        }}>
          🙏 Спасибо! Вопрос отправлен на модерацию. Ответ появится здесь после проверки.
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Загрузка…</p>
      ) : questions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                background: '#fff', border: '1px solid #ede9e4', borderRadius: '10px', padding: '1rem 1.25rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                {q.question}
              </div>
              {q.answer && (
                <div style={{
                  background: '#faf9f7', borderRadius: '8px', padding: '0.75rem 1rem', marginTop: '0.5rem',
                  fontSize: '0.9rem', color: '#444', lineHeight: 1.6,
                }}>
                  <span style={{ fontWeight: 700, color: '#c0392b', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Ответ:</span>
                  <div style={{ marginTop: '0.35rem' }}>{q.answer}</div>
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.5rem' }}>
                {formatDate(q.created_at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center', color: '#999', background: '#faf9f7', border: '1.5px dashed #e8e4df',
          borderRadius: '12px', padding: '1.75rem 1rem',
        }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>💬</div>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>Пока вопросов нет. Будьте первым — задайте вопрос по этой теме!</p>
        </div>
      )}
    </section>
  )
}
