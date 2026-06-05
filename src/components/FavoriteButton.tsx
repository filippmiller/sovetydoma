'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import AuthModal from '@/components/auth/AuthModal'
import { getLocalFavorites, saveLocalFavorites, setPendingAuthIntent } from '@/lib/favorites'

interface Props {
  slug: string
  // Accepted for call-site compatibility; saved_articles has no title column.
  title?: string
}

// Local writes still happen here for instant UI + cache while logged in.
// Migration on auth is what moves anon saves to server (now robust + intent-aware).
// Use the centralized saveLocalFavorites (re-exported) for consistency with cards.

export default function FavoriteButton({ slug }: Props) {
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [showPlus, setShowPlus] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      await Promise.resolve()
      if (cancelled) return

      // Check localStorage (shared helper)
      const favs = getLocalFavorites()
      setSaved(favs.includes(slug))

      // Check Supabase auth and saved_articles
      try {
        const sb = getSupabase()
        const { data } = await sb.auth.getUser()
        const uid = data.user?.id ?? null
        if (cancelled) return
        setUserId(uid)

        if (uid) {
          const { data: row } = await sb
            .from('saved_articles')
            .select('article_slug')
            .eq('user_id', uid)
            .eq('article_slug', slug)
            .maybeSingle()
          if (cancelled) return
          if (row) setSaved(true)
        }
      } catch {
        // Auth not configured or table doesn't exist — localStorage only
      }
    })()

    // Live reaction to auth changes (e.g. login inside the modal opened by this button).
    // This lets us update userId + re-validate from DB and keep the heart state without a full page reload,
    // preserving the article/list context after auth-triggered favorite.
    const sb = getSupabase()
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const uid = session?.user?.id ?? null
        setUserId(uid)
        if (uid) {
          // Best-effort recheck; ignore errors (table/RLS/network) — UI already optimistic
          void sb.from('saved_articles')
            .select('article_slug')
            .eq('user_id', uid)
            .eq('article_slug', slug)
            .maybeSingle()
            .then(({ data: row }) => {
              if (!cancelled && row) setSaved(true)
            })
          // Also opportunistically process any pending intent for this tab (no-op if none)
          // (the main processing happens in AuthModal/AuthButton after sign-in)
        }
      } else if (event === 'SIGNED_OUT') {
        setUserId(null)
        setSaved(getLocalFavorites().includes(slug))
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [slug])

  const toggle = async () => {
    const nextSaved = !saved
    setSaved(nextSaved)

    // localStorage (shared helper for read)
    const favs = getLocalFavorites()
    if (nextSaved) {
      if (!favs.includes(slug)) saveLocalFavorites([...favs, slug])
      setShowPlus(true)
      setTimeout(() => setShowPlus(false), 600)
      // Anonymous user saved while logged out: store explicit intent so post-login
      // we ensure this exact article is in DB (idempotent) and can keep context.
      if (!userId) {
        setPendingAuthIntent({ action: 'favorite', slug, returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined })
        setShowAuth(true)
      }
    } else {
      saveLocalFavorites(favs.filter((s) => s !== slug))
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
