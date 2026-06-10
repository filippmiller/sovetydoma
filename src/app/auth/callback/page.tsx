'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

/**
 * OAuth callback page for Supabase Auth providers (Yandex, VK, Google, etc.).
 *
 * Static-export safe: this runs entirely client-side. It exchanges the
 * PKCE authorization code for a Supabase session and then redirects the
 * user to their intended destination.
 */
const YANDEX_STATE_KEY = 'sovetydoma_yandex_oauth_state'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Завершаем вход…')

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        if (error) {
          throw new Error(errorDescription || error)
        }

        // Custom Yandex OAuth flow: we initiated it and stored a CSRF state.
        // Distinguish from Supabase-native codes by the presence of that state.
        const returnedState = url.searchParams.get('state')
        const storedYandexState = (() => {
          try { return window.sessionStorage.getItem(YANDEX_STATE_KEY) } catch { return null }
        })()
        if (storedYandexState) {
          try { window.sessionStorage.removeItem(YANDEX_STATE_KEY) } catch { /* ignore */ }
          if (!returnedState || returnedState !== storedYandexState) {
            throw new Error('state_mismatch')
          }
          if (!code) throw new Error('authorization_code_missing')
          const apiBase = (process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '').trim().replace(/\/+$/, '')
          if (!apiBase) throw new Error('yandex_api_not_configured')
          const res = await fetch(`${apiBase}/auth/yandex/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: `${window.location.origin}/auth/callback/` }),
          })
          const body = await res.json().catch(() => ({})) as { ok?: boolean; actionLink?: string; error?: string; message?: string }
          if (!res.ok || !body.ok || !body.actionLink) {
            throw new Error(body.message || body.error || 'yandex_exchange_failed')
          }
          if (!cancelled) {
            setStatus('success')
            setMessage('Вход выполнен! Перенаправляем…')
            window.location.href = body.actionLink
          }
          return
        }

        if (!code) {
          // If there's no code, check for hash-based tokens (implicit flow fallback)
          const hash = window.location.hash
          if (hash.includes('access_token')) {
            // Supabase client automatically picks up tokens from the hash
            // when initialized. Just verify the session exists.
            const sb = getSupabase()
            const { data, error: sessionError } = await sb.auth.getSession()
            if (sessionError || !data.session) {
              throw new Error('session_not_found')
            }
            if (!cancelled) {
              setStatus('success')
              setMessage('Вход выполнен! Перенаправляем…')
              redirectToDestination()
            }
            return
          }
          throw new Error('authorization_code_missing')
        }

        const sb = getSupabase()
        const { error: exchangeError } = await sb.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          // PKCE verifier might have been lost (third-party cookie blocking,
          // private browsing, or cross-domain issues). Try implicit fallback.
          if (exchangeError.message?.toLowerCase().includes('pkce') || exchangeError.message?.toLowerCase().includes('code_verifier')) {
            console.warn('oauth_pkce_failed_trying_implicit_fallback', exchangeError.message)
            const hash = window.location.hash
            if (hash.includes('access_token')) {
              const { data, error: sessionError } = await sb.auth.getSession()
              if (!sessionError && data.session) {
                if (!cancelled) {
                  setStatus('success')
                  setMessage('Вход выполнен! Перенаправляем…')
                  redirectToDestination()
                }
                return
              }
            }
          }
          throw exchangeError
        }

        if (!cancelled) {
          setStatus('success')
          setMessage('Вход выполнен! Перенаправляем…')
          redirectToDestination()
        }
      } catch (err) {
        console.error('oauth_callback_error', err)
        if (!cancelled) {
          setStatus('error')
          setMessage(mapOAuthError((err as Error).message))
        }
      }
    }

    handleCallback()

    return () => { cancelled = true }
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f3ef',
      padding: '1rem',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '400px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          {status === 'processing' ? '⏳' : status === 'success' ? '✅' : '⚠️'}
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#1a1a1a' }}>
          {status === 'processing' ? 'Вход через соцсеть' : status === 'success' ? 'Готово' : 'Не удалось войти'}
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
          {message}
        </p>
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => window.location.href = '/moy-kabinet/'}
              style={{
                padding: '0.75rem 1rem',
                background: '#c0392b',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Попробовать войти другим способом
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1rem',
                background: 'transparent',
                color: '#666',
                border: '1.5px solid #e0dbd5',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Повторить попытку
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function redirectToDestination() {
  // Prefer the intended destination if stored, otherwise go to cabinet.
  // Open-redirect guard: only allow same-origin relative paths ("/...") so a
  // script that poisoned sessionStorage can't bounce a freshly-authed user to
  // an external phishing page.
  const raw = window.sessionStorage.getItem('auth_redirect_to') || '/moy-kabinet/'
  window.sessionStorage.removeItem('auth_redirect_to')
  let destination = '/moy-kabinet/'
  if (/^\/(?!\/)/.test(raw)) {
    // Same-origin relative path.
    destination = raw
  } else {
    try {
      const u = new URL(raw, window.location.origin)
      if (u.origin === window.location.origin) destination = u.pathname + u.search + u.hash
    } catch {
      // malformed — keep the safe default
    }
  }
  window.location.replace(destination)
}

function mapOAuthError(raw: string): string {
  const m = raw.toLowerCase()
  if (m.includes('pkce') || m.includes('code_verifier')) {
    return 'Браузер заблокировал необходимые данные для безопасного входа. Попробуйте отключить режим "инкогнито" или войти по email.'
  }
  if (m.includes('access_denied')) {
    return 'Доступ не предоставлен. Вы отменили вход или приложение не авторизовано.'
  }
  if (m.includes('session_not_found')) {
    return 'Сессия не найдена. Попробуйте войти снова.'
  }
  if (m.includes('authorization_code_missing')) {
    return 'Не получен код авторизации. Попробуйте войти снова.'
  }
  if (m.includes('state_mismatch')) {
    return 'Проверка безопасности входа не пройдена. Попробуйте войти снова.'
  }
  if (m.includes('yandex_api_not_configured')) {
    return 'Вход через Яндекс пока не настроен на сервере. Попробуйте войти по email.'
  }
  return 'Не удалось завершить вход через соцсеть. Попробуйте другой способ.'
}
