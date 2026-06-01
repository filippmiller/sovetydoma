'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Which tab to show first (default 'login'). */
  initialTab?: 'login' | 'register'
  /** Optional context line shown under the title, e.g. why the modal opened. */
  reason?: string
}

export default function AuthModal({ isOpen, onClose, initialTab = 'login', reason }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [success, setSuccess] = useState<'welcome' | 'verify' | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const resetId = window.setTimeout(() => {
      setError('')
      setInfo('')
      setSuccess(null)
      setTab(initialTab)
    }, 0)
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.clearTimeout(resetId)
      window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose, initialTab])

  // Portal target — only available in the browser. Combined with the
  // `if (!isOpen) return null` guard below, this never runs during SSR.
  if (!isOpen || typeof document === 'undefined') return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(err.message === 'Email not confirmed'
        ? 'Email ещё не подтверждён. Проверьте письмо с подтверждением или запросите его повторно.'
        : err.message)
      return
    }
    setSuccess('welcome')
    setTimeout(() => {
      onClose()
      window.location.reload()
    }, 1000)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!displayName.trim()) { setError('Введите имя пользователя'); return }
    const emailRedirectTo = getAuthRedirectTo()
    setLoading(true)
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo,
      },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSuccess('verify')
  }

  const resendConfirmation = async () => {
    if (!email.trim()) { setError('Введите email, чтобы отправить письмо повторно'); return }
    setError('')
    setInfo('')
    const emailRedirectTo = getAuthRedirectTo()
    setResending(true)
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo },
    })
    setResending(false)
    if (err) {
      setError(err.message === 'email rate limit exceeded'
        ? 'Лимит писем временно исчерпан. Попробуйте позже или напишите разработчику.'
        : err.message)
      return
    }
    setInfo('Письмо подтверждения отправлено повторно. Проверьте входящие и спам.')
  }

  const switchTab = (t: 'login' | 'register') => {
    setTab(t)
    setError('')
    setInfo('')
    setSuccess(null)
  }

  // Render through a portal to <body> so the fixed overlay is never trapped
  // by an ancestor's containing block (e.g. a card's transform/overflow).
  return createPortal(
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 12px 48px rgba(0,0,0,0.2)',
        padding: '2rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top accent strip */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #c0392b, #e74c3c)',
          borderRadius: '16px 16px 0 0',
        }} />

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: '#f5f3f0',
            border: 'none',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            fontSize: '1.1rem',
            cursor: 'pointer',
            color: '#888',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>

        {/* Title */}
        <div style={{ marginBottom: '0.35rem', marginTop: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a' }}>
            {tab === 'login' ? 'Вход в СоветыДома' : 'Регистрация'}
          </h2>
        </div>

        {/* Benefit subtitle (or contextual reason if the modal was invoked from an action) */}
        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: reason ? '#c0392b' : '#888', fontWeight: reason ? 600 : 400 }}>
          {reason
            ? reason
            : tab === 'login'
              ? 'Сохраняйте статьи, оставляйте комментарии'
              : 'Присоединяйтесь — это бесплатно'}
        </p>

        {/* Tab switcher — pill style */}
        <div style={{
          display: 'flex',
          background: '#f5f3f0',
          borderRadius: '10px',
          padding: '4px',
          marginBottom: '1.5rem',
          gap: '4px',
        }}>
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                flex: 1,
                padding: '0.5rem 0',
                fontSize: '0.88rem',
                fontWeight: 700,
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#c0392b' : '#888',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {t === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          ))}
        </div>

        {/* Success states */}
        {success === 'welcome' && (
          <div style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: '#27ae60',
            fontSize: '1rem',
            fontWeight: 700,
          }}>
            🎉 Добро пожаловать!
          </div>
        )}

        {success === 'verify' && (
          <div style={{
            background: '#f0fff4',
            border: '1.5px solid #b2dfdb',
            borderRadius: '10px',
            padding: '1.25rem',
            textAlign: 'center',
            color: '#1e8449',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📧</div>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
              Проверьте почту для подтверждения
            </p>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.82rem', color: '#555' }}>
              Мы отправили письмо на {email}
            </p>
            <button type="button" onClick={resendConfirmation} disabled={resending} style={{ ...btnStyle, marginTop: '1rem', width: '100%' }}>
              {resending ? 'Отправляем...' : 'Отправить письмо ещё раз'}
            </button>
            {info && <p style={{ ...successTextStyle, marginTop: '0.7rem' }}>{info}</p>}
            {error && <p style={{ ...errorStyle, marginTop: '0.7rem' }}>{error}</p>}
          </div>
        )}

        {/* Login form */}
        {!success && tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <div style={inputWrapStyle}>
                <span style={iconStyle}>📧</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Пароль</label>
              <div style={inputWrapStyle}>
                <span style={iconStyle}>🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </div>
            </div>
            {error && <p style={errorStyle}>{error}</p>}
            {info && <p style={successTextStyle}>{info}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Входим…' : 'Продолжить'}
            </button>
            {error.includes('Email ещё не подтверждён') && (
              <button type="button" onClick={resendConfirmation} disabled={resending} style={{ ...secondaryBtnStyle }}>
                {resending ? 'Отправляем...' : 'Отправить письмо подтверждения ещё раз'}
              </button>
            )}
          </form>
        )}

        {/* Register form */}
        {!success && tab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Имя пользователя</label>
              <div style={inputWrapStyle}>
                <span style={iconStyle}>👤</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Ваше имя"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <div style={inputWrapStyle}>
                <span style={iconStyle}>📧</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Пароль</label>
              <div style={inputWrapStyle}>
                <span style={iconStyle}>🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={6}
                  placeholder="Минимум 6 символов"
                  style={inputStyle}
                />
              </div>
            </div>
            {error && <p style={errorStyle}>{error}</p>}
            {info && <p style={successTextStyle}>{info}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Регистрируем…' : 'Продолжить'}
            </button>
          </form>
        )}

        {/* Social proof footer */}
        <p style={{
          margin: '1.25rem 0 0 0',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#bbb',
        }}>
          🏠 Уже 500+ читателей СоветыДома
        </p>
      </div>
    </div>,
    document.body,
  )
}

function getAuthRedirectTo() {
  if (typeof window === 'undefined') return 'https://1001sovet.ru/moy-kabinet/'
  const origin = window.location.origin
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const siteOrigin = isLocal ? origin : 'https://1001sovet.ru'
  return `${siteOrigin}/moy-kabinet/`
}

// --- Shared styles ---
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#555',
  marginBottom: '0.35rem',
}

const inputWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: '1.5px solid #e0dbd5',
  borderRadius: '8px',
  overflow: 'hidden',
  background: '#faf9f7',
  transition: 'border-color 0.2s',
}

const iconStyle: React.CSSProperties = {
  padding: '0 0.5rem 0 0.75rem',
  fontSize: '1rem',
  userSelect: 'none',
  flexShrink: 0,
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.65rem 0.75rem 0.65rem 0.25rem',
  border: 'none',
  background: 'transparent',
  fontSize: '0.95rem',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
}

const errorStyle: React.CSSProperties = {
  color: '#c0392b',
  fontSize: '0.85rem',
  margin: 0,
  background: '#fff0f0',
  border: '1px solid #f5c6cb',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
}

const successTextStyle: React.CSSProperties = {
  color: '#1e8449',
  fontSize: '0.85rem',
  margin: 0,
  background: '#f0fff4',
  border: '1px solid #b2dfdb',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
}

const btnStyle: React.CSSProperties = {
  backgroundColor: '#c0392b',
  color: '#fff',
  border: 'none',
  borderRadius: '9px',
  padding: '0.75rem 1rem',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.2s, opacity 0.2s',
  marginTop: '0.25rem',
}

const secondaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  color: '#c0392b',
  border: '1.5px solid #c0392b',
  borderRadius: '9px',
  padding: '0.7rem 1rem',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
