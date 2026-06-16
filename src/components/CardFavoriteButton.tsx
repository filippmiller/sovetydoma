'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import AuthModal from '@/components/auth/AuthModal'
import CollectionDropdown from '@/components/CollectionDropdown'
import { getLocalFavorites, saveLocalFavorites, setPendingAuthIntent } from '@/lib/favorites'

interface Props {
  slug: string
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
  const [showAuth, setShowAuth] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.resolve()
      if (cancelled) return

      setMounted(true)
      setSaved(getLocalFavorites().includes(slug))
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
        // localStorage-only mode
      }
    })()

    // React to SIGNED_IN from modal (or elsewhere) without requiring page reload.
    const sb = getSupabase()
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const uid = session?.user?.id ?? null
        setUserId(uid)
        if (uid) {
          void sb
            .from('saved_articles')
            .select('article_slug')
            .eq('user_id', uid)
            .eq('article_slug', slug)
            .maybeSingle()
            .then(({ data: row }) => {
              if (!cancelled && row) setSaved(true)
            })
        }
      } else if (event === 'SIGNED_OUT') {
        setUserId(null)
        setSaved(getLocalFavorites().includes(slug))
        setShowDropdown(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [slug])

  const doToggleSaved = async () => {
    const next = !saved
    setSaved(next)

    const favs = getLocalFavorites()
    if (next) {
      if (!favs.includes(slug)) saveLocalFavorites([...favs, slug])
      if (!userId) {
        setPendingAuthIntent({
          action: 'favorite',
          slug,
          returnTo: typeof window !== 'undefined' ? window.location.pathname : undefined,
        })
        setShowAuth(true)
      }
    } else {
      saveLocalFavorites(favs.filter((s) => s !== slug))
    }

    if (userId) {
      try {
        const sb = getSupabase()
        if (next) {
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
        // localStorage already updated
      }
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // Card is wrapped in a <Link> — don't navigate when tapping the heart.
    e.preventDefault()
    e.stopPropagation()

    if (!userId) {
      // Anonymous: legacy toggle
      doToggleSaved()
    } else {
      // Authenticated: open collection dropdown
      setShowDropdown((prev) => !prev)
    }
  }

  const label = saved ? 'Убрать из избранного' : 'В избранное'

  return (
    <div
      style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', zIndex: 2 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleClick}
        aria-label={label}
        title={label}
        style={{
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
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.12)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        <span aria-hidden="true">{mounted && saved ? '❤️' : '🤍'}</span>
      </button>

      {showDropdown && userId && (
        <CollectionDropdown
          slug={slug}
          userId={userId}
          isSaved={saved}
          onToggleSaved={doToggleSaved}
          onClose={() => setShowDropdown(false)}
          position="right"
        />
      )}

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
