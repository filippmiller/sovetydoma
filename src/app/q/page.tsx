'use client'

import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/utils'

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

export default function AllQuestionsPage() {
  const [questions, setQuestions] = useState<ArticleQuestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!PHOTO_WORKER) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`${PHOTO_WORKER}/article-questions`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        if (!res.ok) throw new Error('fetch_failed')
        const data = (await res.json()) as { questions: ArticleQuestion[] }
        setQuestions(data.questions || [])
      } catch {
        setQuestions([])
      }
      setLoading(false)
    }
    void load()
  }, [])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: q.answer ? {
        '@type': 'Answer',
        text: q.answer,
      } : undefined,
    })),
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1a1a1a', lineHeight: 1.3, margin: '0 0 1.5rem' }}>
        Вопросы и ответы — 1001sov
      </h1>

      {loading ? (
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Загрузка…</p>
      ) : questions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                background: '#fff', border: '1px solid #ede9e4', borderRadius: '10px',
                padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#aaa' }}>
                  {formatDate(q.created_at)}
                </div>
                <span style={{ fontSize: '0.72rem', color: '#bbb', fontStyle: 'italic' }}>
                  {q.article_slug}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center', color: '#999', background: '#faf9f7', border: '1.5px dashed #e8e4df',
          borderRadius: '12px', padding: '2rem 1rem',
        }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>💬</div>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>Пока вопросов нет. Скоро здесь появятся ответы экспертов.</p>
        </div>
      )}
    </div>
  )
}
