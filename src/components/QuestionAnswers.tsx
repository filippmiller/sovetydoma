'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import type { AnswerRow } from '@/lib/questions'
import AuthModal from '@/components/auth/AuthModal'

interface Props {
  questionId: string
  /** Approved answers known at build time (SSG). Live ones merge on top. */
  initialAnswers: AnswerRow[]
}

/** Live answers list + answer form on a /q/[slug] page. */
export default function QuestionAnswers({ questionId, initialAnswers }: Props) {
  const [answers, setAnswers] = useState<AnswerRow[]>(initialAnswers)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('Аноним')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const sb = getSupabase()
        const { data: u } = await sb.auth.getUser()
        if (u.user) {
          setUserId(u.user.id)
          setUserName(u.user.email?.split('@')[0] || 'Пользователь')
        }
        // Refresh approved answers live (in case newer than the build snapshot)
        const { data } = await sb
          .from('question_answers')
          .select('*')
          .eq('question_id', questionId)
          .eq('status', 'approved')
          .order('created_at', { ascending: true })
        if (data && data.length) setAnswers(data as AnswerRow[])
      } catch { /* offline / not configured */ }
    })()
  }, [questionId])

  const submit = async () => {
    if (!userId) { setShowAuth(true); return }
    if (body.trim().length < 1) return
    setError('')
    setSubmitting(true)
    try {
      const sb = getSupabase()
      const { error: err } = await sb.from('question_answers').insert({
        question_id: questionId,
        body: body.trim(),
        user_id: userId,
        author_name: userName,
        status: 'pending',
      })
      if (err) { setError('Не удалось отправить ответ.'); setSubmitting(false); return }
      setSubmitted(true)
      setBody('')
    } catch {
      setError('Сервис временно недоступен')
    }
    setSubmitting(false)
  }

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '1rem' }}>
        Ответы {answers.length > 0 && <span style={{ color: '#aaa', fontWeight: 600 }}>({answers.length})</span>}
      </h2>

      {answers.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.75rem' }}>
          {answers.map((a) => (
            <div key={a.id} style={{ background: '#faf9f7', border: '1px solid #ede9e4', borderRadius: '10px', padding: '0.9rem 1.1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.3rem' }}>
                {a.author_persona ? '🤖 ' : ''}{a.author_name}
              </div>
              <p style={{ margin: 0, color: '#333', fontSize: '0.93rem', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{a.body}</p>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#999', fontSize: '0.92rem', marginBottom: '1.5rem' }}>Пока ответов нет. Будьте первым!</p>
      )}

      {/* Answer form */}
      <div style={{ background: '#faf8f6', border: '1.5px solid #ede9e4', borderRadius: '12px', padding: '1.25rem' }}>
        {submitted ? (
          <div style={{ color: '#1e8449', fontWeight: 600, fontSize: '0.92rem' }}>🙏 Спасибо! Ответ отправлен на модерацию.</div>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.5rem' }}>Ваш ответ</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
              placeholder="Поделитесь опытом…"
              style={{ width: '100%', minHeight: '90px', boxSizing: 'border-box', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0.65rem 0.8rem', fontSize: '0.93rem', fontFamily: 'inherit', resize: 'vertical' }}
            />
            {error && <p style={{ color: '#c0392b', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{error}</p>}
            <div style={{ textAlign: 'right', marginTop: '0.6rem' }}>
              <button onClick={submit} disabled={submitting || !body.trim()} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.4rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting || !body.trim() ? 0.6 : 1 }}>
                {submitting ? 'Отправляем…' : 'Ответить'}
              </button>
            </div>
          </>
        )}
      </div>

      {showAuth && (
        <AuthModal isOpen onClose={() => setShowAuth(false)} initialTab="register" reason="Войдите, чтобы ответить на вопрос." />
      )}
    </section>
  )
}
