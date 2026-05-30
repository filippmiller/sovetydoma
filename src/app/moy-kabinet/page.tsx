'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import { getArticleMeta } from '@/lib/article-index'

interface SavedArticle {
  article_slug: string
  saved_at: string
}

interface UserArticle {
  id: string
  title: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  created_at: string
  category: string
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Черновик',      color: '#666',    bg: '#f0ede8' },
  pending:  { label: 'На проверке',   color: '#e67e22', bg: '#fef3e2' },
  approved: { label: 'Опубликовано',  color: '#27ae60', bg: '#e9f7ef' },
  rejected: { label: 'Отклонено',     color: '#c0392b', bg: '#fdecea' },
}

export default function MoyKabinetPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<'saved' | 'articles'>('saved')
  const [saved, setSaved] = useState<SavedArticle[]>([])
  const [articles, setArticles] = useState<UserArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      if (!u) { router.replace('/'); return }
      setUserId(u.id)

      const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      if (p) {
        setProfile(p as Profile)
        setEditName((p as Profile).display_name || '')
        setEditBio((p as Profile).bio || '')
      }

      const { data: s } = await supabase
        .from('saved_articles')
        .select('*')
        .eq('user_id', u.id)
        .order('saved_at', { ascending: false })
      setSaved((s as SavedArticle[]) || [])

      const { data: a } = await supabase
        .from('user_articles')
        .select('*')
        .eq('author_id', u.id)
        .order('created_at', { ascending: false })
      setArticles((a as UserArticle[]) || [])

      setLoading(false)
    })
  }, [router])

  const saveProfile = async () => {
    if (!userId) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ display_name: editName, bio: editBio })
      .eq('id', userId)
    setProfile((prev) => prev ? { ...prev, display_name: editName, bio: editBio } : prev)
    setSaving(false)
    setEditMode(false)
  }

  const removeSaved = async (slug: string) => {
    if (!userId) return
    await supabase.from('saved_articles').delete().eq('user_id', userId).eq('article_slug', slug)
    setSaved((prev) => prev.filter((s) => s.article_slug !== slug))
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '4rem auto', padding: '0 1rem', textAlign: 'center', color: '#aaa' }}>
        Загрузка…
      </div>
    )
  }

  const joinedDate = profile ? null : null
  const displayName = profile?.display_name || 'Пользователь'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Profile header */}
      <div style={{
        background: '#fff', border: '1px solid #e8e4df', borderRadius: '12px',
        padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.25rem', alignItems: 'flex-start',
      }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '50%',
          backgroundColor: '#c0392b', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', fontWeight: 800, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          {editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Имя пользователя</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>О себе</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={saveProfile} disabled={saving} style={redBtnStyle}>
                  {saving ? 'Сохраняем…' : 'Сохранить'}
                </button>
                <button onClick={() => setEditMode(false)} style={outlineBtnStyle}>Отмена</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.25rem' }}>
                    {displayName}
                  </h1>
                  {profile?.bio && (
                    <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 0.4rem', lineHeight: 1.5 }}>
                      {profile.bio}
                    </p>
                  )}
                  <span style={{
                    display: 'inline-block', fontSize: '0.75rem', color: '#aaa',
                    backgroundColor: '#f5f3f0', borderRadius: '4px', padding: '2px 8px',
                  }}>
                    {profile?.role === 'admin' ? '🛡 Администратор' : profile?.role === 'moderator' ? '⚡ Модератор' : '👤 Пользователь'}
                  </span>
                </div>
                <button onClick={() => setEditMode(true)} style={outlineBtnStyle}>
                  Редактировать
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #f0ede8', marginBottom: '1.5rem' }}>
        {(['saved', 'articles'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.6rem 1.2rem', fontSize: '0.93rem', fontWeight: 600,
              color: tab === t ? '#c0392b' : '#888',
              borderBottom: `2px solid ${tab === t ? '#c0392b' : 'transparent'}`,
              marginBottom: '-2px',
            }}
          >
            {t === 'saved' ? `Сохранённые статьи (${saved.length})` : `Мои статьи (${articles.length})`}
          </button>
        ))}
      </div>

      {tab === 'saved' && (
        saved.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: '3rem 0' }}>
            <p style={{ marginBottom: '1rem' }}>Нет сохранённых статей</p>
            <Link href="/" style={{ color: '#c0392b', fontWeight: 600 }}>Читать статьи →</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {saved.map((s) => {
              const meta = getArticleMeta(s.article_slug)
              const href = meta?.category ? `/${meta.category}/${s.article_slug}/` : `/search/?q=${encodeURIComponent(s.article_slug)}`
              return (
              <div key={s.article_slug} style={{
                background: '#fff', border: '1px solid #e8e4df', borderRadius: '8px',
                padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <span style={{ fontSize: '1.1rem' }}>🔖</span>
                <Link
                  href={href}
                  style={{ flex: 1, color: '#1a1a1a', textDecoration: 'none', fontWeight: 600, fontSize: '0.93rem' }}
                >
                  {meta?.title || s.article_slug}
                </Link>
                <button
                  onClick={() => removeSaved(s.article_slug)}
                  title="Удалить"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#bbb', fontSize: '1rem', padding: '2px 6px',
                  }}
                >
                  ×
                </button>
              </div>
              )
            })}
          </div>
        )
      )}

      {tab === 'articles' && (
        <>
          <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
            <Link href="/napisat/" style={redBtnStyle as React.CSSProperties}>
              ✏️ Написать статью
            </Link>
          </div>
          {articles.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '3rem 0' }}>
              <p>Вы ещё не писали статей</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {articles.map((a) => {
                const st = STATUS_LABELS[a.status] || STATUS_LABELS.draft
                return (
                  <div key={a.id} style={{
                    background: '#fff', border: '1px solid #e8e4df', borderRadius: '8px',
                    padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.93rem', color: '#1a1a1a', marginBottom: '0.25rem' }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#aaa' }}>
                        {a.category} · {new Date(a.created_at).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: '20px',
                      fontSize: '0.78rem', fontWeight: 700,
                      color: st.color, backgroundColor: st.bg,
                    }}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#555', marginBottom: '0.3rem',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px',
  border: '1.5px solid #ddd', fontSize: '0.93rem', outline: 'none', boxSizing: 'border-box',
}
const redBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '5px',
  backgroundColor: '#c0392b', color: '#fff', border: 'none',
  borderRadius: '7px', padding: '0.5rem 1.1rem',
  fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
}
const outlineBtnStyle: React.CSSProperties = {
  background: 'none', border: '1.5px solid #ddd', borderRadius: '7px',
  padding: '0.45rem 1rem', fontSize: '0.85rem', cursor: 'pointer', color: '#555',
}
