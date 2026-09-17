'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { safeAssign } from '@/lib/auth/safe-redirect'
import { verifyOAuthState } from '@/lib/auth/oauth-state'
import { readAuthHash, getAuthHashParams, clearAuthHash } from '@/lib/auth/recovery-hash'
import { getConsentStatus, submitAuthenticatedConsent } from '@/lib/privacy/privacy-worker-client'

/**
 * OAuth callback page for Supabase Auth providers (Yandex, VK, Google, etc.).
 *
 * Static-export safe: this runs entirely client-side. It exchanges the
 * PKCE authorization code for a Supabase session and then redirects the
 * user to their intended destination.
 */
const YANDEX_STATE_KEY = 'sovetydoma_yandex_oauth_state'

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error' | 'consent-required'>('processing')
  const [message, setMessage] = useState('Завершаем вход…')
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [consentError, setConsentError] = useState('')

  useEffect(() => {
    let cancelled = false

    // 152-FZ (canon §1.1, audit 2026-08-18 P1 fix): VK ID / Yandex sign-in
    // never shows the terms/privacy checkboxes RegisterForm shows for email
    // signup, so a social-auth account could otherwise reach a live session
    // with zero consent_events evidence. Called right after a session is
    // established (PKCE exchange or the hash-based fallback below) — shows
    // a one-time consent gate only when something is actually missing.
    // Fails OPEN on our own status-check failure (network blip, worker
    // down): we redirect the user through rather than block login on it,
    // trading a small residual evidence gap for not locking legitimate
    // users out of their own account.
    async function proceedAfterSession() {
      const s = await getConsentStatus()
      if (!cancelled) {
        if (s.ok && !(s.terms && s.privacyPolicy)) {
          setStatus('consent-required')
          return
        }
        setStatus('success')
        setMessage('Вход выполнен! Перенаправляем…')
        redirectToDestination()
      }
    }

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
          // One-time CSRF token: delete BEFORE comparing so a replayed
          // callback URL can never succeed twice.
          try { window.sessionStorage.removeItem(YANDEX_STATE_KEY) } catch { /* ignore */ }
          if (!verifyOAuthState(storedYandexState, returnedState)) {
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
            // C1: guard against open-redirect via server-supplied actionLink
            if (!safeAssign(body.actionLink)) {
              throw new Error('yandex_invalid_action_link')
            }
          }
          return
        }

        if (!code) {
          // No PKCE code — check for hash-based tokens (implicit flow fallback).
          // The early sanitizer (app/layout.tsx, bead 0h3.11) moved the hash off
          // the URL into a safe store before Yandex Metrika could read it, so
          // detectSessionInUrl can no longer see it — establish the session
          // explicitly from the captured tokens.
          const hash = readAuthHash()
          if (hash.includes('access_token')) {
            const params = getAuthHashParams()
            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token')
            const sb = getSupabase()
            const { data, error: sessionError } = access_token && refresh_token
              ? await sb.auth.setSession({ access_token, refresh_token })
              : await sb.auth.getSession()
            if (sessionError || !data.session) {
              throw new Error('session_not_found')
            }
            clearAuthHash()
            if (!cancelled) await proceedAfterSession()
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
            const hash = readAuthHash()
            if (hash.includes('access_token')) {
              const params = getAuthHashParams()
              const access_token = params.get('access_token')
              const refresh_token = params.get('refresh_token')
              const { data, error: sessionError } = access_token && refresh_token
                ? await sb.auth.setSession({ access_token, refresh_token })
                : await sb.auth.getSession()
              if (!sessionError && data.session) {
                clearAuthHash()
                if (!cancelled) await proceedAfterSession()
                return
              }
            }
          }
          throw exchangeError
        }

        if (!cancelled) await proceedAfterSession()
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

  const handleConsentAccept = async () => {
    if (!consentChecked) return
    setConsentBusy(true)
    setConsentError('')
    const [termsOk, privacyOk] = await Promise.all([
      submitAuthenticatedConsent('terms'),
      submitAuthenticatedConsent('privacy_policy'),
    ])
    setConsentBusy(false)
    if (!termsOk || !privacyOk) {
      setConsentError('Не удалось сохранить согласие. Попробуйте ещё раз.')
      return
    }
    setStatus('success')
    setMessage('Вход выполнен! Перенаправляем…')
    redirectToDestination()
  }

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
          {status === 'processing' ? '⏳' : status === 'success' ? '✅' : status === 'consent-required' ? '📋' : '⚠️'}
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem', color: '#1a1a1a' }}>
          {status === 'processing' ? 'Вход через соцсеть' : status === 'success' ? 'Готово' : status === 'consent-required' ? 'Ещё один шаг' : 'Не удалось войти'}
        </h1>
        {status !== 'consent-required' && (
          <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
            {message}
          </p>
        )}
        {status === 'consent-required' && (
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: '0.88rem', color: '#666', margin: '0 0 1rem', lineHeight: 1.5 }}>
              Прежде чем продолжить, подтвердите согласие с условиями использования сайта и обработкой персональных данных.
            </p>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem', color: '#444', marginBottom: '1rem', lineHeight: 1.4 }}>
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                style={{ marginTop: '0.2rem' }}
              />
              <span>
                Я согласен(а) с <a href="/terms" target="_blank">Условиями использования</a> и даю согласие
                на обработку персональных данных в соответствии с <a href="/privacy" target="_blank">Политикой конфиденциальности</a>.
              </span>
            </label>
            {consentError && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: '0.75rem' }} role="alert">{consentError}</p>}
            <button
              type="button"
              onClick={handleConsentAccept}
              disabled={!consentChecked || consentBusy}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: consentChecked ? '#2e7d32' : '#9db99f',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: consentChecked ? 'pointer' : 'not-allowed',
              }}
            >
              {consentBusy ? 'Сохраняем…' : 'Продолжить'}
            </button>
          </div>
        )}
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
