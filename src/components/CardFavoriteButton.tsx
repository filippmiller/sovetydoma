'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

interface Props {
  slug: string
}

const STORAGE_KEY = 'favorites'

function readFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

/**
 * Compact heart overlay for article cards. Lives inside a <Link>, so clicks
 * must not bubble into navigation. Mirrors FavoriteButton's storage:
 * localStorage `favorites` for everyone, plus saved_articles when logged in.
 */
export default function CardFavoriteButton({ slug }: Props) {
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setSaved(readFavorites().includes(slug))
    ;(async () => {
      try {
        const sb = getSupabase()
        const { data } = await sb.auth.getUser()
        const uid = data.user?.id ?? null
        setUserId(uid)
        if (uid) {
          const { data: row } = await sb
            .from('saved_articles')
            .select('article_slug')
            .eq('user_id', uid)
            .eq('article_slug', slug)
            .maybeSingle()
          if (row) setSaved(true)
        }
      } catch {
        // localStorage-only mode
      }
    })()
  }, [slug])

  const toggle = async (e: React.MouseEvent) => {
    // Card is wrapped in a <Link> — don't navigate when tapping the heart.
    e.preventDefault()
    e.stopPropagation()

    const next = !saved
    setSaved(next)

    const favs = readFavorites()
    if (next) {
      if (!favs.includes(slug)) localStorage.setItem(STORAGE_KEY, JSON.stringify([...favs, slug]))
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favs.filter((s) => s !== slug)))
    }

    if (userId) {
      try {
        const sb = getSupabase()
        if (next) {
          await sb
            .from('saved_articles')
            .upsert({ user_id: userId, article_slug: slug }, { onConflict: 'user_id,article_slug' })
        } else {
          await sb.from('saved_articles').delete().eq('user_id', userId).eq('article_slug', slug)
        }
      } catch {
        // localStorage already updated
      }
    }
  }

  // Render a neutral placeholder until mounted so SSR markup matches.
  const label = saved ? 'Убрать из избранного' : 'В избранное'

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      style={{
        position: 'absolute',
        top: '0.75rem',
        right: '0.75rem',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: 'none',
        background: 'rgba(255,255,255,0.9)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.05rem',
        lineHeight: 1,
        padding: 0,
        zIndex: 2,
        transition: 'transform 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <span aria-hidden="true">{mounted && saved ? '❤️' : '🤍'}</span>
    </button>
  )
}
