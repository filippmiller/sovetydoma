'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { slugify } from '@/lib/slug'
import { questionHref, type QuestionRow } from '@/lib/questions'
import AuthModal from '@/components/auth/AuthModal'

interface Props {
  /** Article slug this Q&A block belongs to. */
  articleSlug: string
}

/**
 * Functional "Вопросы по статье":
 *  - lists APPROVED questions for this article (live from Supabase)
 *  - lets a logged-in user ask a new question (stored pending → moderation)
 *  - links each question to its indexable /q/[slug] page
 */
export default function ArticleQuestionsBlock({ articleSlug }: Props) {
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('Аноним')
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
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
        const { data } = await sb
          .from('questions')
          .select('*')
          .eq('article_slug', articleSlug)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
        setQuestions((data as QuestionRow[]) || [])
      } catch {
        // Supabase not configured — show empty state
      }
      setLoading(false)
    })()
  }, [articleSlug])

  const startAsk = () => {
    if (!userId) { setShowAuth(true); return }
    setOpen(true)
  }

  const submit = async () => {
    if (title.trim().length < 5) { setError('Вопрос слишком короткий'); return }
    setError('')
    setSubmitting(true)
    try {
      const sb = getSupabase()
      // Unique-ish slug: transliterated title + short random suffix.
      const suffix = Math.abs(hash(title + Date.now())).toString(36).slice(0, 4)
      const slug = `${slugify(title)}-${suffix}`
      const { error: err } = await sb.from('questions').insert({
        slug,
        article_slug: articleSlug,
        title: title.trim(),
        body: body.trim(),
        user_id: userId,
        author_name: userName,
        status: 'pending',
      })
      if (err) {
        const rateLimited = /rate_limited/i.test(err.message || '')
        setError(rateLimited
          ? 'Слишком много вопросов за короткое время. Подождите немного.'
          : 'Не удалось отправить вопрос. Попробуйте позже.')
        setSubmitting(false); return
      }
      setSubmitted(true)
      setOpen(false)
      setTitle(''); setBody('')
    } catch {
      setError('Сервис временно недоступен')
    }
    setSubmitting(false)
  }

  return (
    <section style={{ marginTop: '2.5rem', borderTop: '1px solid #f0ece7', paddingTop: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a' }}>❓ Вопросы по статье</h2>
        <button
          onClick={startAsk}
          style={{
            padding: '0.45rem 1.1rem', borderRadius: '8px', border: 'none',
            background: '#c0392b', color: '#fff', fontSize: '0.85rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Задать вопрос
        </button>
      </div>

      {/* Ask form */}
      {open && (
        <div style={{ background: '#faf8f6', border: '1.5px solid #ede9e4', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={300}
            placeholder="Ваш вопрос (кратко)"
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.95rem', fontFamily: 'inherit', marginBottom: '0.6rem' }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            placeholder="Подробности (необязательно)"
            style={{ width: '100%', minHeight: '80px', boxSizing: 'border-box', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0.6rem 0.8rem', fontSize: '0.92rem', fontFamily: 'inherit', resize: 'vertical' }}
          />
          {error && <p style={{ color: '#c0392b', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.6rem' }}>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: '1.5px solid #ddd', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', color: '#777', fontFamily: 'inherit' }}>Отмена</button>
            <button onClick={submit} disabled={submitting} style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1.3rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Отправляем…' : 'Отправить'}
            </button>
          </div>
        </div>
      )}

      {submitted && (
        <div style={{ background: '#f0fff4', border: '1.5px solid #b2dfdb', borderRadius: '10px', padding: '0.9rem 1.1rem', marginBottom: '1.25rem', color: '#1e8449', fontSize: '0.9rem' }}>
          🙏 Спасибо! Ваш вопрос отправлен на модерацию и появится после проверки.
        </div>
      )}

      {/* List */}
      {loading ? (
        <p style={{ color: '#aaa', fontSize: '0.9rem' }}>Загрузка…</p>
      ) : questions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {questions.map((q) => (
            <Link key={q.id} href={questionHref(q.slug)} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#faf9f7', border: '1px solid #ede9e4', borderRadius: '10px', padding: '0.9rem 1.1rem' }}>
                <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem' }}>{q.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '0.3rem' }}>
                  {q.answers_count > 0 ? `💬 ${q.answers_count} ${plural(q.answers_count, 'ответ', 'ответа', 'ответов')}` : 'Пока без ответа'}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#999', background: '#faf9f7', border: '1.5px dashed #e8e4df', borderRadius: '12px', padding: '1.75rem 1rem' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>💬</div>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>Пока вопросов нет. Будьте первым — задайте вопрос по этой статье!</p>
        </div>
      )}

      {showAuth && (
        <AuthModal
          isOpen
          onClose={() => setShowAuth(false)}
          initialTab="register"
          reason="Войдите, чтобы задать вопрос по статье."
        />
      )}
    </section>
  )
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
