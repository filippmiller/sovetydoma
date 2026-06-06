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
  // Prefer the intended destination if stored, otherwise go to cabinet
  const destination = window.sessionStorage.getItem('auth_redirect_to') || '/moy-kabinet/'
  window.sessionStorage.removeItem('auth_redirect_to')
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
  return 'Не удалось завершить вход через соцсеть. Попробуйте другой способ.'
}
