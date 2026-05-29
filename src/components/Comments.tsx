'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Comment } from '@/lib/supabase'
import AuthModal from '@/components/auth/AuthModal'

interface Props {
  slug: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин. назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} дн. назад`
  const months = Math.floor(days / 30)
  return `${months} мес. назад`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

interface CommentItemProps {
  comment: Comment
  depth: number
  onReply: (parentId: string) => void
}

function CommentItem({ comment, depth, onReply }: CommentItemProps) {
  const name = comment.profiles?.display_name || 'Пользователь'
  const initials = getInitials(name)

  return (
    <div style={{
      display: 'flex', gap: '0.75rem',
      marginLeft: depth > 0 ? '2rem' : 0,
      paddingLeft: depth > 0 ? '1rem' : 0,
      borderLeft: depth > 0 ? '2px solid #e8e4df' : 'none',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        backgroundColor: '#c0392b22', color: '#c0392b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.78rem', fontWeight: 800, flexShrink: 0,
      }}>
        {initials}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#222' }}>{name}</span>
          <span style={{ fontSize: '0.78rem', color: '#aaa' }}>{timeAgo(comment.created_at)}</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.93rem', lineHeight: 1.6, color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {comment.content}
        </p>
        <button
          onClick={() => onReply(comment.id)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.78rem', color: '#888', padding: '0.3rem 0', marginTop: '0.2rem',
          }}
        >
          Ответить
        </button>
      </div>
    </div>
  )
}

export default function Comments({ slug }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })

    supabase
      .from('comments')
      .select('*, profiles(display_name, avatar_url)')
      .eq('article_slug', slug)
      .eq('is_approved', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setComments((data as Comment[]) || [])
        setLoading(false)
      })
  }, [slug])

  const submitComment = async (content: string, parentId: string | null) => {
    if (!content.trim() || !userId) return
    setSubmitting(true)
    const optimistic: Comment = {
      id: `opt-${Date.now()}`,
      article_slug: slug,
      user_id: userId,
      content: content.trim(),
      parent_id: parentId,
      is_approved: true,
      created_at: new Date().toISOString(),
    }
    setComments((prev) => [...prev, optimistic])
    if (parentId) { setReplyText(''); setReplyTo(null) } else setText('')

    const { data, error } = await supabase
      .from('comments')
      .insert({ article_slug: slug, user_id: userId, content: content.trim(), parent_id: parentId })
      .select('*, profiles(display_name, avatar_url)')
      .single()

    setSubmitting(false)
    if (!error && data) {
      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? (data as Comment) : c)))
    }
  }

  const topLevel = comments.filter((c) => !c.parent_id)
  const replies = (parentId: string) => comments.filter((c) => c.parent_id === parentId)

  return (
    <section style={{ marginTop: '3rem', borderTop: '2px solid #f0ede8', paddingTop: '2rem' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1a1a1a' }}>
        Комментарии ({comments.length})
      </h2>

      {loading ? (
        <p style={{ color: '#aaa', fontSize: '0.88rem' }}>Загрузка…</p>
      ) : comments.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: '0.88rem', marginBottom: '1.5rem' }}>Пока нет комментариев. Будьте первым!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
          {topLevel.map((c) => (
            <div key={c.id}>
              <CommentItem comment={c} depth={0} onReply={(id) => { setReplyTo(id); setReplyText('') }} />
              {replies(c.id).map((r) => (
                <div key={r.id} style={{ marginTop: '0.75rem' }}>
                  <CommentItem comment={r} depth={1} onReply={(id) => { setReplyTo(id); setReplyText('') }} />
                </div>
              ))}
              {replyTo === c.id && (
                <div style={{ marginLeft: '3rem', marginTop: '0.75rem', borderLeft: '2px solid #c0392b33', paddingLeft: '1rem' }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder="Ваш ответ…"
                    style={textareaStyle}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => submitComment(replyText, c.id)}
                      disabled={submitting || !replyText.trim()}
                      style={submitBtnStyle}
                    >
                      {submitting ? 'Отправляем…' : 'Ответить'}
                    </button>
                    <button
                      onClick={() => { setReplyTo(null); setReplyText('') }}
                      style={cancelBtnStyle}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Comment form */}
      <div style={{ background: '#faf8f6', borderRadius: '10px', padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: '#333' }}>
          Оставить комментарий
        </h3>
        {!userId ? (
          <button
            onClick={() => setAuthOpen(true)}
            style={{
              backgroundColor: '#c0392b', color: '#fff', border: 'none',
              borderRadius: '7px', padding: '0.6rem 1.2rem',
              fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Войдите, чтобы оставить комментарий
          </button>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Напишите комментарий…"
              style={textareaStyle}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#aaa' }}>{text.length}/2000</span>
              <button
                onClick={() => submitComment(text, null)}
                disabled={submitting || !text.trim()}
                style={submitBtnStyle}
              >
                {submitting ? 'Отправляем…' : 'Отправить'}
              </button>
            </div>
          </>
        )}
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </section>
  )
}

const textareaStyle: React.CSSProperties = {
  width: '100%', borderRadius: '7px', border: '1.5px solid #ddd',
  padding: '0.6rem 0.8rem', fontSize: '0.93rem', resize: 'vertical',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  lineHeight: 1.6,
}

const submitBtnStyle: React.CSSProperties = {
  backgroundColor: '#c0392b', color: '#fff', border: 'none',
  borderRadius: '7px', padding: '0.5rem 1.2rem',
  fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #ddd', borderRadius: '7px',
  padding: '0.5rem 1rem', fontSize: '0.88rem', cursor: 'pointer', color: '#666',
}
