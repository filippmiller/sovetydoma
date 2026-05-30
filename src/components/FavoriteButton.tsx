'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import AuthModal from '@/components/auth/AuthModal'

interface Props {
  slug: string
  // Accepted for call-site compatibility; saved_articles has no title column.
  title?: string
}

const STORAGE_KEY = 'favorites'

function getFavoritesFromStorage(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveFavoritesToStorage(slugs: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs))
}

export default function FavoriteButton({ slug }: Props) {
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showPlus, setShowPlus] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    // Check localStorage
    const favs = getFavoritesFromStorage()
    setSaved(favs.includes(slug))

    // Check Supabase auth and saved_articles
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
        // Auth not configured or table doesn't exist — localStorage only
      }
    })()

  }, [slug])

  const toggle = async () => {
    const nextSaved = !saved
    setSaved(nextSaved)

    // localStorage
    const favs = getFavoritesFromStorage()
    if (nextSaved) {
      if (!favs.includes(slug)) saveFavoritesToStorage([...favs, slug])
      setShowPlus(true)
      setTimeout(() => setShowPlus(false), 600)
      // Anonymous user just saved their first favorite — politely invite them
      // to register/login so it syncs across devices. The favorite is already
      // kept in localStorage, so nothing is lost if they dismiss.
      if (!userId) setShowAuth(true)
    } else {
      saveFavoritesToStorage(favs.filter((s) => s !== slug))
    }

    // Supabase
    if (userId) {
      try {
        const sb = getSupabase()
        if (nextSaved) {
          await sb
            .from('saved_articles')
            .upsert({ user_id: userId, article_slug: slug }, { onConflict: 'user_id,article_slug' })
        } else {
          await sb
            .from('saved_articles')
            .delete()
            .eq('user_id', userId)
            .eq('article_slug', slug)
        }
      } catch {
        // Table may not exist yet
      }
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}>
      {/* +1 animation */}
      {showPlus && (
        <span
          style={{
            position: 'absolute',
            top: '-20px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#e74c3c',
            fontWeight: 700,
            fontSize: '0.85rem',
            pointerEvents: 'none',
            animation: 'floatUp 0.6s ease forwards',
          }}
        >
          +1
        </span>
      )}

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-16px); }
        }
      `}</style>

      {/* Heart button */}
      <button
        onClick={toggle}
        aria-label={saved ? 'Убрать из избранного' : 'Добавить в избранное'}
        title={saved ? 'Убрать из избранного' : 'Добавить в избранное'}
        style={{
          width: '44px',
          height: '44px',
          minWidth: '44px',
          minHeight: '44px',
          borderRadius: '50%',
          border: `1.5px solid ${saved ? '#f8c8c8' : '#e0dbd5'}`,
          background: saved ? '#fff0f0' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.35rem',
          transition: 'all 0.2s ease',
          padding: 0,
          lineHeight: 1,
        }}
      >
        {saved ? '❤️' : '🤍'}
      </button>

      {/* Label below */}
      <span style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        color: saved ? '#e74c3c' : '#999',
        transition: 'color 0.2s',
        whiteSpace: 'nowrap',
      }}>
        {saved ? 'В избранном' : 'Сохранить'}
      </span>

      {/* Invite anonymous users to register/login so favorites sync */}
      {showAuth && (
        <AuthModal
          isOpen
          onClose={() => setShowAuth(false)}
          initialTab="register"
          reason="❤️ Сохранили статью! Зарегистрируйтесь, чтобы избранное было на всех устройствах."
        />
      )}
    </div>
  )
}
