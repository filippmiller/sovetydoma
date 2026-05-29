'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AuthModal({ isOpen, onClose }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setError('')
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    onClose()
    window.location.reload()
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) { setError('Введите имя пользователя'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    onClose()
    window.location.reload()
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: '2rem', position: 'relative',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer',
            color: '#888', lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #f0ede8', marginBottom: '1.5rem' }}>
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                padding: '0.6rem 0', fontSize: '0.95rem', fontWeight: 600,
                color: tab === t ? '#c0392b' : '#888',
                borderBottom: `2px solid ${tab === t ? '#c0392b' : 'transparent'}`,
                marginBottom: '-2px', transition: 'color 0.2s',
              }}
            >
              {t === 'login' ? 'Войти' : 'Регистрация'}
            </button>
          ))}
        </div>

        {tab === 'login' ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.3rem' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email"
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.3rem' }}>
                Пароль
              </label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required autoComplete="current-password"
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>
            {error && <p style={{ color: '#c0392b', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Входим…' : 'Войти'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.3rem' }}>
                Имя пользователя
              </label>
              <input
                type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                required
                style={inputStyle}
                placeholder="Ваше имя"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.3rem' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email"
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#444', marginBottom: '0.3rem' }}>
                Пароль
              </label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required autoComplete="new-password" minLength={6}
                style={inputStyle}
                placeholder="Минимум 6 символов"
              />
            </div>
            {error && <p style={{ color: '#c0392b', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem 0.8rem', borderRadius: '6px',
  border: '1.5px solid #ddd', fontSize: '0.95rem', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s',
}

const btnStyle: React.CSSProperties = {
  backgroundColor: '#c0392b', color: '#fff', border: 'none',
  borderRadius: '7px', padding: '0.7rem 1rem',
  fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
  transition: 'background 0.2s', marginTop: '0.25rem',
}
