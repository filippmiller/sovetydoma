'use client'

import { useEffect, useState } from 'react'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import AuthModal from '@/components/auth/AuthModal'

interface Props {
  slug: string
  title?: string
}

export default function BookmarkButton({ slug }: Props) {
  const authConfigured = isSupabaseConfigured()
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(authConfigured)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    if (!authConfigured) return

    const sb = getSupabase()
    sb.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid) {
        const { data: row } = await sb
          .from('saved_articles')
          .select('id')
          .eq('user_id', uid)
          .eq('article_slug', slug)
          .maybeSingle()
        setSaved(!!row)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [authConfigured, slug])

  const toggle = async () => {
    if (!userId) { setAuthOpen(true); return }
    if (saved) {
      setSaved(false)
      await getSupabase()
        .from('saved_articles')
        .delete()
        .eq('user_id', userId)
        .eq('article_slug', slug)
    } else {
      setSaved(true)
      await getSupabase()
        .from('saved_articles')
        .insert({ user_id: userId, article_slug: slug })
    }
  }

  if (loading || !authConfigured) return null

  return (
    <>
      <button
        onClick={toggle}
        title={saved ? 'Удалить из сохранённых' : 'Сохранить статью'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
          fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
          border: saved ? '1.5px solid #27ae60' : '1.5px solid #bbb',
          backgroundColor: saved ? '#27ae6010' : 'transparent',
          color: saved ? '#27ae60' : '#666',
        }}
      >
        🔖 {saved ? 'Сохранено ✓' : 'Сохранить'}
      </button>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
