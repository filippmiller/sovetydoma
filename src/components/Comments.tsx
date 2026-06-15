'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Comment } from '@/lib/supabase'
import AuthModal from '@/components/auth/AuthModal'
import { uploadToR2 } from '@/lib/photos'
import CommentItem from '@/components/comments/CommentItem'
import SkeletonCard from '@/components/comments/CommentSkeleton'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')

interface Props {
  slug: string
}

// --- Auto-resize textarea hook ---
function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(Math.max(el.scrollHeight, 100), 400) + 'px'
  }, [value])
  return ref
}

// --- Main component ---
export default function Comments({ slug }: Props) {
  const commentsConfigured = isSupabaseConfigured()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(commentsConfigured)
  const [userId, setUserId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const mainTextareaRef = useAutoResize(text)
  const replyTextareaRef = useAutoResize(replyText)

  useEffect(() => {
    if (!commentsConfigured) return

    let alive = true
    const sb = getSupabase()

    sb.auth.getUser().then(({ data }) => {
      if (!alive) return
      setUserId(data.user?.id ?? null)
    }).catch(() => {
      if (alive) setUserId(null)
    })

    sb
      .from('comments')
      .select('*, profiles(display_name, avatar_url)')
      .eq('article_slug', slug)
      .eq('is_approved', true)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!alive) return
        setComments((data as Comment[]) || [])
        setLoading(false)
      }, () => {
        if (!alive) return
        setComments([])
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [commentsConfigured, slug])

  const submitComment = async (content: string, parentId: string | null, attach?: File | null) => {
    if (!commentsConfigured || !content.trim() || !userId) return
    const sb = getSupabase()
    setSubmitting(true)
    setNotice(null)

    // 1) Optional photo → upload to R2 first, keep the key.
    let photoKey: string | null = null
    if (attach) {
      const up = await uploadToR2({ file: attach, articleSlug: slug })
      if (!up.ok) { setSubmitting(false); setNotice('Не удалось загрузить фото. Комментарий не отправлен.'); return }
      photoKey = up.key
    }

    // 2) Insert as pending (is_approved defaults false now → moderation).
    const { data, error } = await sb
      .from('comments')
      .insert({ article_slug: slug, user_id: userId, content: content.trim(), parent_id: parentId, photo_path: photoKey })
      .select('*, profiles(display_name, avatar_url)')
      .single()

    if (error || !data) {
      setSubmitting(false)
      const rateLimited = /rate_limited/i.test(error?.message || '')
      setNotice(rateLimited
        ? 'Слишком много комментариев за короткое время. Подождите немного и попробуйте снова.'
        : 'Не удалось отправить комментарий.')
      return
    }

    // 3) Fire automated moderation; if it approves, show the comment immediately.
    let approved = false
    try {
      const { data: sess } = await sb.auth.getSession()
      const token = sess.session?.access_token
      const res = await fetch(`${SUPABASE_URL}/functions/v1/moderate-comment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: (data as Comment).id }),
      })
      const j = await res.json()
      approved = !!j?.is_approved
    } catch { /* stays pending for a human */ }

    if (parentId) { setReplyText(''); setReplyTo(null) } else { setText(''); setPhoto(null) }
    setSubmitting(false)

    if (approved) {
      setComments((prev) => [...prev, { ...(data as Comment), is_approved: true }])
    } else {
      setNotice('🕓 Спасибо! Комментарий отправлен на модерацию и появится после проверки.')
    }
  }

  const topLevel = comments.filter((c) => !c.parent_id)
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId)
  const approvedCount = comments.length

  if (!commentsConfigured) return null

  return (
    <section style={{ marginTop: '3rem', borderTop: '2px solid #f0ede8', paddingTop: '2rem' }}>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a' }}>
          💬 Комментарии
        </h2>
        {!loading && (
          <span style={{
            background: '#f0ede8',
            color: '#666',
            borderRadius: '999px',
            fontSize: '0.78rem',
            fontWeight: 700,
            padding: '0.15rem 0.6rem',
            lineHeight: 1.5,
          }}>
            {approvedCount}
          </span>
        )}
      </div>

      {/* Comment list */}
      {loading ? (
        <div style={{ marginBottom: '2rem' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : comments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem 1rem',
          marginBottom: '2rem',
          background: '#faf9f7',
          borderRadius: '12px',
          border: '1.5px dashed #e8e4df',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💭</div>
          <p style={{ margin: 0, color: '#999', fontSize: '0.92rem' }}>
            Будьте первым! Поделитесь своим мнением.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
          {topLevel.map((c) => (
            <div key={c.id} style={{ borderBottom: '1px solid #f5f3f0', paddingBottom: '1rem' }}>
              <CommentItem
                comment={c}
                depth={0}
                onReply={(id) => { setReplyTo(id); setReplyText('') }}
              />

              {/* Replies */}
              {getReplies(c.id).length > 0 && (
                <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {getReplies(c.id).map((r) => (
                    <CommentItem
                      key={r.id}
                      comment={r}
                      depth={1}
                      onReply={(id) => { setReplyTo(id); setReplyText('') }}
                    />
                  ))}
                </div>
              )}

              {/* Inline reply form */}
              {replyTo === c.id && (
                <div style={{
                  marginLeft: '3rem',
                  marginTop: '0.85rem',
                  borderLeft: '3px solid #c0392b33',
                  paddingLeft: '1rem',
                }}>
                  <textarea
                    ref={replyTextareaRef}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    maxLength={2000}
                    placeholder="Ваш ответ…"
                    style={{ ...textareaStyle, minHeight: '80px' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#bbb' }}>{replyText.length}/2000</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => { setReplyTo(null); setReplyText('') }}
                        style={cancelBtnStyle}
                      >
                        Отмена
                      </button>
                      <button
                        onClick={() => submitComment(replyText, c.id)}
                        disabled={submitting || !replyText.trim()}
                        style={{
                          ...submitBtnStyle,
                          opacity: submitting || !replyText.trim() ? 0.6 : 1,
                        }}
                      >
                        {submitting ? 'Отправляем…' : 'Ответить'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Comment form box */}
      <div style={{
        background: '#faf8f6',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1.5px solid #ede9e4',
      }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: '#333', margin: '0 0 1rem 0' }}>
          Оставить комментарий
        </h3>

        {!userId ? (
          /* Not logged in */
          <div style={{
            textAlign: 'center',
            padding: '1.5rem 1rem',
            background: '#fff',
            borderRadius: '10px',
            border: '1.5px solid #ede9e4',
          }}>
            <p style={{ margin: '0 0 1rem 0', color: '#666', fontSize: '0.92rem' }}>
              Войдите, чтобы оставить комментарий
            </p>
            <button
              onClick={() => setShowAuth(true)}
              style={{
                backgroundColor: '#c0392b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.8rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Войти
            </button>
          </div>
        ) : (
          /* Logged in */
          <>
            <textarea
              ref={mainTextareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Напишите комментарий…"
              style={{ ...textareaStyle, minHeight: '100px' }}
            />
            {/* Optional photo attachment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.82rem', color: '#777', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                📷 Прикрепить фото
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
              </label>
              {photo && <span style={{ fontSize: '0.8rem', color: '#1e8449' }}>✓ {photo.name.slice(0, 28)}</span>}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '0.6rem',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}>
              <span style={{ fontSize: '0.75rem', color: '#bbb' }}>{text.length}/2000</span>
              <button
                onClick={() => submitComment(text, null, photo)}
                disabled={submitting || !text.trim()}
                style={{
                  ...submitBtnStyle,
                  opacity: submitting || !text.trim() ? 0.6 : 1,
                }}
              >
                {submitting ? 'Отправляем…' : 'Отправить'}
              </button>
            </div>
            {notice && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: notice.startsWith('🕓') ? '#1e8449' : '#c0392b' }}>{notice}</p>
            )}
          </>
        )}
      </div>

      {showAuth && <AuthModal isOpen onClose={() => setShowAuth(false)} />}
    </section>
  )
}

// --- Shared styles ---
const textareaStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '8px',
  border: '1.5px solid #ddd',
  padding: '0.75rem 0.9rem',
  fontSize: '0.93rem',
  resize: 'vertical',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  lineHeight: 1.65,
  maxHeight: '400px',
  transition: 'border-color 0.2s',
  background: '#fff',
}

const submitBtnStyle: React.CSSProperties = {
  backgroundColor: '#c0392b',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  padding: '0.6rem 1.5rem',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.2s, opacity 0.2s',
}

const cancelBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1.5px solid #ddd',
  borderRadius: '8px',
  padding: '0.6rem 1rem',
  fontSize: '0.88rem',
  cursor: 'pointer',
  color: '#777',
  fontFamily: 'inherit',
}
