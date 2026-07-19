'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const ACCENT = '#c0392b'

const NAV_LINKS = [
  { key: 'overview', label: 'Обзор', href: '/admin/', icon: '📊' },
  { key: 'analytics', label: 'Аналитика', href: '/admin/analytics/', icon: '📈' },
  { key: 'articles', label: 'Статьи', href: '/admin/articles/', icon: '📄' },
  { key: 'media', label: 'Медиа статей', href: '/admin/media/', icon: '🖼️' },
  { key: 'photos', label: 'Фото читателей', href: '/admin/photos/', icon: '📷' },
  { key: 'questions', label: 'Вопросы по статьям', href: '/admin/questions/', icon: '💬' },
  { key: 'push', label: 'Push-уведомления', href: '/admin/push/', icon: '📲' },
  { key: 'responder', label: 'Ответчик VK/FB', href: '/admin/responder/', icon: '💬' },
  // Categories / Tags / Settings are not implemented yet — omit dead href="#" links.
]

interface AdminUser {
  email: string
  name: string
  role: string
  loginAt: number
}

interface Props {
  activeNav: string
  children: React.ReactNode
}

export default function AdminShell({ activeNav, children }: Props) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { getSupabase } = await import('@/lib/supabase')
        const sb = getSupabase()
        const { data } = await sb.auth.getUser()
        if (data.user) {
          const { data: p } = await sb.from('profiles').select('display_name, role').eq('id', data.user.id).maybeSingle()
          setUser({
            email: data.user.email || '',
            name: p?.display_name || data.user.email?.split('@')[0] || 'Админ',
            role: p?.role === 'admin' ? 'Администратор' : (p?.role || ''),
            loginAt: Date.now(),
          })
        }
      } catch (e) {
        // Non-fatal: the shell still renders, but never swallow silently.
        console.warn('[AdminShell] profile fetch failed', e)
      }
    })()
  }, [])

  async function handleLogout() {
    try {
      const { getSupabase } = await import('@/lib/supabase')
      await getSupabase().auth.signOut()
    } catch (e) {
      console.warn('[AdminShell] signOut failed', e)
    }
    window.location.href = '/admin/login/'
  }

  // Avatar initials from name
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'АД'

  const sidebar = (
    <div style={{
      width: '220px',
      minWidth: '220px',
      background: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
    }}>
      {/* Logo */}
      <div style={{
        padding: '1.5rem 1.25rem 1rem',
        borderBottom: '1px solid #2e2e2e',
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
            🏠 СоветыДома
          </div>
          <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.15rem' }}>
            Панель управления
          </div>
        </Link>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '1rem 0' }}>
        {NAV_LINKS.map(link => {
          const isActive = activeNav === link.key
          return (
            <a
              key={link.key}
              href={link.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.65rem 1.25rem',
                fontSize: '0.9rem',
                color: isActive ? '#fff' : '#aaa',
                textDecoration: 'none',
                background: isActive ? ACCENT : 'transparent',
                borderLeft: isActive ? `3px solid #fff` : '3px solid transparent',
                fontWeight: isActive ? 700 : 400,
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.background = '#2a2a2a'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = '#aaa'
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <span style={{ fontSize: '1rem' }}>{link.icon}</span>
              {link.label}
            </a>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #2e2e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#fff',
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || '...'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.role || ''}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '0.5rem',
            background: '#2a2a2a',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '6px',
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#3a1a1a'
            e.currentTarget.style.color = '#e57373'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#2a2a2a'
            e.currentTarget.style.color = '#aaa'
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop sidebar */}
      <div style={{ display: 'flex' }} className="admin-sidebar-desktop">
        {sidebar}
      </div>

      {/* Mobile top bar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        zIndex: 1000,
      }} className="admin-mobile-bar">
        <span style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>🏠 СоветыДома</span>
        <button
          onClick={() => setMobileMenuOpen(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '1.4rem',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
          aria-label="Меню"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          display: 'flex',
        }}>
          <div style={{ width: '220px' }}>{sidebar}</div>
          <div
            style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, background: '#f4f4f4' }}>
        {children}
      </main>

      <style>{`
        @media (min-width: 769px) {
          .admin-mobile-bar { display: none !important; }
        }
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          main { padding-top: 56px; }
        }
      `}</style>
    </div>
  )
}
