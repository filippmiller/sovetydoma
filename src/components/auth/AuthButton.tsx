'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import AuthModal from './AuthModal'
import { migrateLocalFavoritesToServer, clearLocalFavorites, processPendingFavoriteIntent } from '@/lib/favorites'

export default function AuthButton() {
  const authConfigured = isSupabaseConfigured()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authConfigured) return
    let alive = true
    const sb = getSupabase()

    const loadProfile = async (userId: string, user?: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any

      setProfile(null)
      const { data: p } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (p) {
        setProfile(p as Profile)
        return
      }
      // P1 profile reliability fallback: create missing profile row after auth
      if (user) {
        const display_name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Пользователь'
        const { error: upErr } = await sb
          .from('profiles')
          .upsert({
            id: userId,
            display_name,
            bio: '',
            avatar_url: '',
            role: 'user' as any, // eslint-disable-line @typescript-eslint/no-explicit-any

            articles_count: 0,
          }, { onConflict: 'id' })
        if (!upErr) {
          const { data: newP } = await sb
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
          if (newP && alive) setProfile(newP as Profile)
        }
      }
    }

    sb.auth.getUser().then(({ data }) => {
      if (!alive) return
      const u = data.user
      setUser(u ?? null)
      if (u) {
        loadProfile(u.id, u).catch(() => {})
        // Catch any local favorites from before this page load / previous anon session.
        // migrate() no longer takes/ trusts caller id — it reads the real session.
        migrateLocalFavoritesToServer().catch(() => {})
        processPendingFavoriteIntent().catch(() => {})
      }
    }).catch(() => {})

    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadProfile(u.id, u).catch(() => {})
        // Migrate pending local favorites (covers post-login, recovery, cross-tab, etc.)
        // Also process explicit auth intent (favorite while logged-out) if present.
        migrateLocalFavoritesToServer().catch(() => {})
        processPendingFavoriteIntent().catch(() => {})
      } else {
        setProfile(null)
      }

      // P0: When user follows password reset link, open the auth modal in reset mode
      if (event === 'PASSWORD_RECOVERY') {
        setModalOpen(true)
      }
    })

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [authConfigured])

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  if (!authConfigured) return null

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          aria-label="Войти или зарегистрироваться"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#c0392b',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            minHeight: '38px',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <span aria-hidden="true">👤</span>
          Войти
        </button>
        <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    )
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Пользователь'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setDropdownOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: '1.5px solid #e0dbd5',
          borderRadius: '20px',
          padding: '3px 10px 3px 3px',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: '#333',
        }}
      >
        <span style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          backgroundColor: '#c0392b',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 800,
          flexShrink: 0,
        }}>
          {initials}
        </span>
        <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayName}
        </span>
        <span style={{ fontSize: '0.65rem', color: '#aaa' }}>▾</span>
      </button>

      {dropdownOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 6px)',
          background: '#fff',
          border: '1px solid #e8e4df',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          minWidth: '170px',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          <Link href="/moy-kabinet/" onClick={() => setDropdownOpen(false)} style={dropItemStyle}>
            👤 Мой кабинет
          </Link>
          <Link href="/napisat/" onClick={() => setDropdownOpen(false)} style={dropItemStyle}>
            ✏️ Написать статью
          </Link>
          <hr style={{ margin: '0', border: 'none', borderTop: '1px solid #f0ede8' }} />
          <button
            onClick={async () => {
              setDropdownOpen(false)
              await getSupabase().auth.signOut().catch(() => {})
              // Privacy fix (browser QA): clear local favorites cache so hearts don't stay "saved"
              // after logout on a shared device. Server side is authoritative for the account.
              clearLocalFavorites()
              window.location.reload()
            }}
            style={{ ...dropItemStyle, width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer' }}
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  )
}

const dropItemStyle: React.CSSProperties = {
  display: 'block',
  padding: '0.6rem 1rem',
  fontSize: '0.88rem',
  color: '#333',
  textDecoration: 'none',
  transition: 'background 0.15s',
}
