'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import AuthModal from './AuthModal'

export default function AuthButton() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      setUser(u ?? null)
      if (u) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single()
          .then(({ data: p }) => { if (p) setProfile(p as Profile) })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', u.id)
          .single()
          .then(({ data: p }) => { if (p) setProfile(p as Profile) })
      } else {
        setProfile(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

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

  if (!mounted) return null

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            backgroundColor: '#c0392b', color: '#fff', border: 'none',
            borderRadius: '6px', padding: '5px 14px', fontSize: '0.82rem',
            fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          Войти
        </button>
        <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    )
  }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'User'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setDropdownOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={dropdownOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: '1.5px solid #e0dbd5',
          borderRadius: '20px', padding: '3px 10px 3px 3px',
          cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#333',
        }}
      >
        <span style={{
          width: '26px', height: '26px', borderRadius: '50%',
          backgroundColor: '#c0392b', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, flexShrink: 0,
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
          position: 'absolute', right: 0, top: 'calc(100% + 6px)',
          background: '#fff', border: '1px solid #e8e4df', borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '160px', zIndex: 200,
          overflow: 'hidden',
        }}>
          <Link
            href="/moy-kabinet/"
            onClick={() => setDropdownOpen(false)}
            style={dropItemStyle}
          >
            👤 Мой кабинет
          </Link>
          <Link
            href="/napisat/"
            onClick={() => setDropdownOpen(false)}
            style={dropItemStyle}
          >
            ✏️ Написать статью
          </Link>
          <hr style={{ margin: '0', border: 'none', borderTop: '1px solid #f0ede8' }} />
          <button
            onClick={async () => {
              setDropdownOpen(false)
              await supabase.auth.signOut()
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
  display: 'block', padding: '0.6rem 1rem',
  fontSize: '0.88rem', color: '#333', textDecoration: 'none',
  transition: 'background 0.15s',
}
