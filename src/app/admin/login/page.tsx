'use client'

import { useState, useEffect, useRef } from 'react'

const ACCENT = '#c0392b'
const ACCENT_DARK = '#a93226'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('admin_auth')
      if (raw) {
        window.location.href = '/admin/'
        return
      }
    } catch {}
    emailRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Small artificial delay for UX
    setTimeout(() => {
      if (
        email.trim().toLowerCase() === 'admin@sovetydoma.ru' &&
        password === 'sovetydoma2026!'
      ) {
        const authData = {
          email: email.trim().toLowerCase(),
          name: 'Филипп М.',
          role: 'Главный редактор',
          loginAt: Date.now(),
        }
        sessionStorage.setItem('admin_auth', JSON.stringify(authData))
        window.location.href = '/admin/'
      } else {
        setError('Неверный email или пароль')
        setLoading(false)
      }
    }, 350)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2c2c2c 100%)',
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '2.5rem 2.25rem',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Logo / site name */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: ACCENT,
            marginBottom: '1rem',
          }}>
            <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>🏠</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.02em' }}>
            СоветыДома
          </div>
          <div style={{ fontSize: '0.88rem', color: '#888', marginTop: '0.25rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Панель управления
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#dc2626',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '0.88rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div style={{ marginBottom: '1.1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@sovetydoma.ru"
              required
              autoComplete="username"
              style={{
                width: '100%',
                padding: '0.7rem 0.9rem',
                border: '1.5px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.97rem',
                outline: 'none',
                transition: 'border-color 0.15s',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = ACCENT)}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#444', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Пароль
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '0.7rem 2.8rem 0.7rem 0.9rem',
                  border: '1.5px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.97rem',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = ACCENT)}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: '#9ca3af',
                  fontSize: '1rem',
                  lineHeight: 1,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.8rem',
              background: loading ? '#e0948c' : ACCENT,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              fontFamily: 'inherit',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget.style.background = ACCENT_DARK) }}
            onMouseLeave={e => { if (!loading) (e.currentTarget.style.background = ACCENT) }}
          >
            {loading ? 'Вход...' : 'Войти в панель'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.78rem', color: '#bbb' }}>
          Доступ только для редакторов СоветыДома
        </p>
      </div>
    </div>
  )
}
