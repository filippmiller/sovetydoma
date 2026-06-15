'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSupabase, supabase } from '@/lib/supabase'
import { migrateLocalFavoritesToServer, processPendingFavoriteIntent } from '@/lib/favorites'
import { mapAuthError, mapVkAuthError, mapOAuthError } from '@/lib/auth/error-messages'
import { safeAssign } from '@/lib/auth/safe-redirect'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import ForgotPasswordForm from './ForgotPasswordForm'
import ResetPasswordForm from './ResetPasswordForm'

declare global {
  interface Window {
    VKIDSDK?: {
      Config: {
        init(config: Record<string, unknown>): void
      }
      ConfigResponseMode: { Callback: string }
      ConfigSource: { LOWCODE: string }
      WidgetEvents: { ERROR: string }
      OneTapInternalEvents: { LOGIN_SUCCESS: string }
      OneTap: new () => {
        render(options: Record<string, unknown>): {
          on(event: string, cb: (payload: { code?: string; device_id?: string } | unknown) => void): unknown
        }
      }
    }
  }
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

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
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [success, setSuccess] = useState<'welcome' | 'verify' | 'forgot-sent' | 'reset-success' | null>(null)
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login')
  const [resendCooldown, setResendCooldown] = useState(0)
  // For P1.2 registration confirm password
  // reset confirm is in reset form state if needed; for register:
  const [confirmRegisterPassword, setConfirmRegisterPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const vkContainerRef = useRef<HTMLDivElement>(null)

  // P0 reset flow state (kept minimal for this vertical slice)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [vkLoading, setVkLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  const handleOAuthSignIn = useCallback(async (provider: 'yandex' | 'google' | 'vk') => {
    setError('')
    setOauthLoading(provider)
    try {
      const sb = getSupabase()
      const redirectTo = getOAuthRedirectTo()
      const { data, error: oauthError } = await sb.auth.signInWithOAuth({
        provider: provider as unknown as Parameters<typeof sb.auth.signInWithOAuth>[0]['provider'],
        options: { redirectTo },
      })
      if (oauthError) throw oauthError
      if (data.url) {
        window.sessionStorage.setItem('auth_redirect_to', getAuthRedirectTo())
        window.location.href = data.url
      } else {
        throw new Error('oauth_url_missing')
      }
    } catch (err) {
      setError(mapOAuthError((err as Error).message))
      setOauthLoading(null)
    }
  }, [])

  // Yandex: self-hosted Supabase has no `yandex` provider, so we run a custom
  // authorization-code flow. Redirect to Yandex with a CSRF `state`; the return
  // is handled on /auth/callback/ which exchanges the code via the worker.
  const handleYandexSignIn = useCallback(() => {
    setError('')
    const clientId = (process.env.NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID || '').trim()
    if (!clientId) {
      setError('Этот способ входа пока не настроен. Попробуйте войти по email.')
      return
    }
    setOauthLoading('yandex')
    const state = createPkceVerifier() // reuse the CSPRNG token helper for state
    const redirectUri = getOAuthRedirectTo()
    try {
      window.sessionStorage.setItem(YANDEX_STATE_KEY, state)
      window.sessionStorage.setItem('auth_redirect_to', getAuthRedirectTo())
    } catch { /* sessionStorage unavailable — flow will fail the state check, which is safe */ }
    const authorizeUrl = `https://oauth.yandex.ru/authorize?response_type=code`
      + `&client_id=${encodeURIComponent(clientId)}`
      + `&redirect_uri=${encodeURIComponent(redirectUri)}`
      + `&state=${encodeURIComponent(state)}`
      + `&force_confirm=yes`
    window.location.href = authorizeUrl
  }, [])

  const handleVkSuccess = useCallback(async (payload: { code?: string; device_id?: string }) => {
    setError('')
    setInfo('')
    setVkLoading(true)
    try {
      const apiBase = (process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '').trim().replace(/\/+$/, '')
      if (!apiBase) throw new Error('vk_api_not_configured')
      const codeVerifier = vkContainerRef.current?.dataset.codeVerifier || ''
      if (!payload.code || !payload.device_id || !codeVerifier) throw new Error('vk_payload_missing')
      const res = await fetch(`${apiBase}/auth/vk/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: payload.code,
          device_id: payload.device_id,
          code_verifier: codeVerifier,
        }),
      })
      const body = await res.json().catch(() => ({})) as { ok?: boolean; actionLink?: string; error?: string; message?: string }
      if (!res.ok || !body.ok || !body.actionLink) {
        throw new Error(body.message || body.error || 'vk_exchange_failed')
      }
      // C1: guard against open-redirect via server-supplied actionLink
      if (!safeAssign(body.actionLink)) {
        throw new Error('vk_invalid_action_link')
      }
    } catch (err) {
      setError(mapVkAuthError((err as Error).message))
      setVkLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !isVkAuthEnabled() || tab !== 'login' || mode !== 'login' || success) return
    let cancelled = false
    ;(async () => {
      try {
        await loadVkIdSdk()
        if (cancelled || !vkContainerRef.current || !window.VKIDSDK) return
        const VKID = window.VKIDSDK
        const codeVerifier = createPkceVerifier()
        vkContainerRef.current.dataset.codeVerifier = codeVerifier
        window.sessionStorage.setItem(VK_ID_CODE_VERIFIER_KEY, codeVerifier)
        const redirectUrl = safeRedirectUrl(`${window.location.origin}/api/auth/vk/callback`)
        if (!redirectUrl) {
          if (!cancelled) setError('VK ID временно недоступен (неверный адрес редиректа).')
          return
        }
        VKID.Config.init({
          app: Number(process.env.NEXT_PUBLIC_VK_APP_ID || '54625895'),
          redirectUrl,
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: process.env.NEXT_PUBLIC_VK_SCOPE || 'email',
          codeVerifier,
        })
        const oneTap = new VKID.OneTap()
        const rendered = oneTap.render({
          container: vkContainerRef.current,
          showAlternativeLogin: true,
          oauthList: ['ok_ru', 'mail_ru'],
        })
        rendered.on(VKID.WidgetEvents.ERROR, () => {
          if (!cancelled) setError('Не удалось открыть VK ID. Попробуйте позже.')
        })
        rendered.on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
          void handleVkSuccess(payload as { code?: string; device_id?: string })
        })
      } catch {
        if (!cancelled) setError('VK ID временно недоступен.')
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, tab, mode, success, handleVkSuccess])

  useEffect(() => {
    if (!isOpen) return
    const resetId = window.setTimeout(() => {
      setError('')
      setInfo('')
      setEmailError('')
      setSuccess(null)
      setTab(initialTab)
      setMode('login')
      setEmail('')
      setPassword('')
      setRegisterEmail('')
      setRegisterPassword('')
      setDisplayName('')
      setConfirmRegisterPassword('')
      setNewPassword('')
      setConfirmPassword('')
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

  // P0: Listen for Supabase PASSWORD_RECOVERY event (fires when user follows the reset link and client picks up the tokens)
  useEffect(() => {
    if (!isOpen) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
        setError('')
        setInfo('')
        setSuccess(null)
        // Pre-fill email from the temporary recovery session if available
        if (session?.user?.email) {
          setEmail(session.user.email)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [isOpen])

  // Cooldown timer for resend (P0.2)
  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  // Portal target — only available in the browser. Combined with the
  // `if (!isOpen) return null` guard below, this never runs during SSR.
  if (!isOpen || typeof document === 'undefined') return null

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setEmailError('')

    const form = new FormData(e.currentTarget)
    const submittedEmail = String(form.get('email') || '').trim()
    const submittedPassword = String(form.get('password') || '')
    setEmail(submittedEmail)
    setPassword(submittedPassword)

    if (!isValidEmail(submittedEmail)) {
      setEmailError('Введите корректный email адрес.')
      return
    }
    if (!submittedPassword) {
      setError('Введите пароль.')
      return
    }

    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: submittedEmail, password: submittedPassword })
    setLoading(false)
    if (err) {
      setError(mapAuthError(err.message))
      return
    }

    // Robust favorites intent + localStorage merge (0h3.7):
    // - migrate uses *current session* (never trusts supplied id) + only clears successful
    // - process any explicit pending favorite intent recorded by heart buttons
    // - if partial failure, preserve local + surface readable RU message (no data loss)
    // - after success we close WITHOUT unconditional reload to keep the user in the
    //   intended context (article page or listing) when they clicked favorite while logged out.
    //   Auth state listeners (AuthButton + FavoriteButton/Card) update header/hearts live.
    const mig = await migrateLocalFavoritesToServer()
    await processPendingFavoriteIntent().catch(() => {})

    if (mig.failed.length > 0) {
      setInfo(`Не удалось синхронизировать ${mig.failed.length} из избранного. Они сохранены локально и появятся после следующей синхронизации.`)
    }

    setSuccess('welcome')
    setTimeout(() => {
      onClose()
      // Intentionally no window.location.reload() here:
      // 1) preserves scroll/position and the article context for auth-triggered favorites
      // 2) header (AuthButton) + per-page hearts react to SIGNED_IN via their onAuthStateChange
      // 3) migrate + intent processing already ensured the favorite is (or will be) in DB
      // If a full re-render of complex page state is ever required, user can refresh.
    }, 900)
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setEmailError('')

    const form = new FormData(e.currentTarget)
    const submittedDisplayName = String(form.get('displayName') || '').trim()
    const submittedEmail = String(form.get('email') || '').trim()
    const submittedPassword = String(form.get('password') || '')
    const submittedConfirmPassword = String(form.get('confirmPassword') || '')
    const termsAccepted = form.get('terms') === 'accepted'
    setDisplayName(submittedDisplayName)
    setRegisterEmail(submittedEmail)
    setRegisterPassword(submittedPassword)
    setConfirmRegisterPassword(submittedConfirmPassword)

    if (!submittedDisplayName) { setError('Введите имя пользователя'); return }
    if (!isValidEmail(submittedEmail)) { setEmailError('Введите корректный email адрес.'); return }
    if (submittedPassword.length < 8) { setError('Пароль должен быть не короче 8 символов'); return }
    if (submittedPassword !== submittedConfirmPassword) { setError('Пароли не совпадают'); return }
    if (!termsAccepted) { setError('Подтвердите согласие с условиями и политикой конфиденциальности'); return }

    const emailRedirectTo = getAuthRedirectTo()
    setLoading(true)
    const { error: err } = await supabase.auth.signUp({
      email: submittedEmail,
      password: submittedPassword,
      options: {
        data: { display_name: submittedDisplayName },
        emailRedirectTo,
      },
    })
    setLoading(false)
    if (err) {
      setError(mapAuthError(err.message))
      return
    }
    setSuccess('verify')
    setRegisterPassword('')
    setConfirmRegisterPassword('')
    // Note: for register path the pending favorite intent (if any) is intentionally left in sessionStorage.
    // It will be processed by AuthButton onAuthStateChange (or next explicit login) *after* the user
    // confirms the email and a SIGNED_IN event fires. Register-confirmation end-to-end cannot be
    // fully verified here without real Mailcow/Supabase email delivery (see beads + checklist).
  }

  const resendConfirmation = async () => {
    const targetEmail = (success === 'verify' ? registerEmail : email).trim()
    if (!targetEmail) { setError('Введите email, чтобы отправить письмо повторно'); return }
    setError('')
    setInfo('')
    const emailRedirectTo = getAuthRedirectTo()
    setResending(true)
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email: targetEmail,
      options: { emailRedirectTo },
    })
    setResending(false)
    if (err) {
      setError(mapAuthError(err.message))
      return
    }
    setInfo('Письмо подтверждения отправлено повторно. Проверьте входящие и спам.')
    setResendCooldown(60) // P0.2 cooldown
  }

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEmailError('')
    const form = new FormData(e.currentTarget)
    const submittedEmail = String(form.get('email') || '').trim()
    setEmail(submittedEmail)
    if (!isValidEmail(submittedEmail)) {
      setEmailError('Введите корректный email адрес.')
      return
    }
    setError('')
    setInfo('')
    setLoading(true)

    const redirectTo = getAuthRedirectTo() // will land on cabinet; client can pick up recovery session later
    const { error: err } = await supabase.auth.resetPasswordForEmail(submittedEmail, {
      redirectTo,
    })

    setLoading(false)
    if (err) {
      // Do not leak whether the email exists
      setError('Не удалось отправить письмо. Попробуйте позже.')
      return
    }

    setSuccess('forgot-sent')
  }

  const switchTab = (t: 'login' | 'register') => {
    setTab(t)
    setMode('login')
    setError('')
    setInfo('')
    setEmailError('')
    setSuccess(null)
  }

  const goToForgot = () => {
    setMode('forgot')
    setTab('login') // keep last email if user typed it
    setError('')
    setInfo('')
    setEmailError('')
    setSuccess(null)
  }

  const goBackToLogin = () => {
    setMode('login')
    setError('')
    setInfo('')
    setEmailError('')
    setSuccess(null)
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSetNewPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setInfo('')

    const form = new FormData(e.currentTarget)
    const submittedNewPassword = String(form.get('newPassword') || '')
    const submittedConfirmPassword = String(form.get('confirmPassword') || '')
    setNewPassword(submittedNewPassword)
    setConfirmPassword(submittedConfirmPassword)

    if (!submittedNewPassword || submittedNewPassword.length < 8) {
      setError('Пароль должен быть не короче 8 символов')
      return
    }
    if (submittedNewPassword !== submittedConfirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setResetLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: submittedNewPassword })
    setResetLoading(false)

    if (err) {
      setError(mapAuthError(err.message) || 'Не удалось изменить пароль. Ссылка могла истечь.')
      return
    }

    // Clear sensitive state
    setNewPassword('')
    setConfirmPassword('')
    setSuccess('reset-success')
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
            {mode === 'forgot' ? 'Восстановить пароль' : (tab === 'login' ? 'Вход в СоветыДома' : 'Регистрация')}
          </h2>
        </div>

        {/* Benefit subtitle (or contextual reason if the modal was invoked from an action) */}
        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: reason ? '#c0392b' : '#888', fontWeight: reason ? 600 : 400 }}>
          {reason
            ? reason
            : mode === 'forgot'
              ? 'Мы отправим ссылку для сброса пароля, если такой аккаунт существует'
              : tab === 'login'
                ? 'Сохраняйте статьи, оставляйте комментарии'
                : 'Присоединяйтесь — это бесплатно'}
        </p>

        {/* Tab switcher — pill style (hidden during forgot flow) */}
        {mode !== 'forgot' && (
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
        )}

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
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
              Проверьте почту для подтверждения аккаунта
            </p>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.82rem', color: '#555' }}>
              Мы отправили письмо на <strong>{registerEmail}</strong>. Перейдите по ссылке в письме.
            </p>
            <p style={{ margin: '0.3rem 0 0.6rem 0', fontSize: '0.78rem', color: '#666' }}>
              Если письма нет несколько минут — проверьте папку «Спам».
            </p>
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resending || resendCooldown > 0}
              style={{ ...btnStyle, marginTop: '0.5rem', width: '100%', opacity: (resending || resendCooldown > 0) ? 0.6 : 1 }}
            >
              {resending ? 'Отправляем...' : (resendCooldown > 0 ? `Отправить ещё раз (${resendCooldown}с)` : 'Отправить письмо ещё раз')}
            </button>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
              <button
                type="button"
                onClick={() => {
                  // Allow editing email: go back to register form with current email
                  setSuccess(null)
                  setTab('register')
                  setMode('login')
                }}
                style={{ ...secondaryBtnStyle, flex: 1, fontSize: '0.85rem' }}
              >
                Изменить email
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccess(null)
                  setMode('login')
                  setTab('login')
                }}
                style={{ ...secondaryBtnStyle, flex: 1, fontSize: '0.85rem' }}
              >
                Назад к входу
              </button>
            </div>
            {info && <p style={{ ...successTextStyle, marginTop: '0.7rem' }}>{info}</p>}
            {error && <p style={{ ...errorStyle, marginTop: '0.7rem' }}>{error}</p>}
          </div>
        )}

        {success === 'forgot-sent' && (
          <div style={{
            background: '#f0fff4',
            border: '1.5px solid #b2dfdb',
            borderRadius: '10px',
            padding: '1.25rem',
            textAlign: 'center',
            color: '#1e8449',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📧</div>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
              Если аккаунт с таким email существует, мы отправили инструкции по восстановлению пароля.
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem', color: '#555' }}>
              Проверьте почту (включая папку «Спам»).
            </p>
            <button type="button" onClick={goBackToLogin} style={{ ...secondaryBtnStyle, marginTop: '1rem', width: '100%' }}>
              Вернуться к входу
            </button>
          </div>
        )}

        {success === 'reset-success' && (
          <div style={{
            background: '#f0fff4',
            border: '1.5px solid #b2dfdb',
            borderRadius: '10px',
            padding: '1.25rem',
            textAlign: 'center',
            color: '#1e8449',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>✅</div>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>
              Пароль успешно изменён
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem', color: '#555' }}>
              Теперь вы можете войти с новым паролем.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setSuccess(null)
                  setMode('login')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                style={{ ...secondaryBtnStyle, flex: 1 }}
              >
                Войти
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  // Navigate to cabinet if desired; minimal reload only if needed
                  if (window.location.pathname.includes('moy-kabinet')) {
                    window.location.reload()
                  }
                }}
                style={{ ...btnStyle, flex: 1, marginTop: 0 }}
              >
                В личный кабинет
              </button>
            </div>
          </div>
        )}

        {/* Login form */}
        {!success && tab === 'login' && mode === 'login' && (
          <LoginForm
            email={email}
            password={password}
            error={error}
            info={info}
            emailError={emailError}
            loading={loading}
            vkAuthEnabled={isVkAuthEnabled()}
            vkLoading={vkLoading}
            vkContainerRef={vkContainerRef}
            oauthLoading={oauthLoading}
            onSubmit={handleLogin}
            onEmailChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError('') }}
            onEmailBlur={() => { if (email && !isValidEmail(email)) setEmailError('Введите корректный email адрес.') }}
            onPasswordChange={(e) => setPassword(e.target.value)}
            onGoToForgot={goToForgot}
            onResendConfirmation={resendConfirmation}
            onResending={resending}
            onYandexSignIn={handleYandexSignIn}
            onOAuthSignIn={handleOAuthSignIn}
          />
        )}

        {/* Forgot password request form (P0) */}
        {!success && tab === 'login' && mode === 'forgot' && (
          <ForgotPasswordForm
            email={email}
            emailError={emailError}
            error={error}
            info={info}
            loading={loading}
            onSubmit={handleForgotPassword}
            onEmailChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError('') }}
            onEmailBlur={() => { if (email && !isValidEmail(email)) setEmailError('Введите корректный email адрес.') }}
            onGoBack={goBackToLogin}
          />
        )}

        {/* Reset password completion form (P0) */}
        {!success && mode === 'reset' && (
          <ResetPasswordForm
            email={email}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            error={error}
            info={info}
            resetLoading={resetLoading}
            onSubmit={handleSetNewPassword}
            onNewPasswordChange={(e) => setNewPassword(e.target.value)}
            onConfirmPasswordChange={(e) => setConfirmPassword(e.target.value)}
            onCancel={goBackToLogin}
          />
        )}

        {/* Register form */}
        {!success && tab === 'register' && (
          <RegisterForm
            displayName={displayName}
            registerEmail={registerEmail}
            registerPassword={registerPassword}
            confirmRegisterPassword={confirmRegisterPassword}
            emailError={emailError}
            error={error}
            info={info}
            loading={loading}
            onSubmit={handleRegister}
            onDisplayNameChange={(e) => setDisplayName(e.target.value)}
            onEmailChange={(e) => { setRegisterEmail(e.target.value); if (emailError) setEmailError('') }}
            onEmailBlur={() => { if (registerEmail && !isValidEmail(registerEmail)) setEmailError('Введите корректный email адрес.') }}
            onPasswordChange={(e) => setRegisterPassword(e.target.value)}
            onConfirmPasswordChange={(e) => setConfirmRegisterPassword(e.target.value)}
            onTermsChange={() => { if (error) setError('') }}
          />
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

function getOAuthRedirectTo(): string {
  if (typeof window === 'undefined') return 'https://1001sovet.ru/auth/callback/'
  const origin = window.location.origin
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  const siteOrigin = isLocal ? origin : 'https://1001sovet.ru'
  return `${siteOrigin}/auth/callback/`
}

function isVkAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VK_AUTH_ENABLED === 'true'
}

function safeRedirectUrl(value: string): string | null {
  try {
    const url = new URL(value)
    // Only allow http: and https: protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

const VK_ID_CODE_VERIFIER_KEY = 'sovetydoma_vk_id_code_verifier'
const YANDEX_STATE_KEY = 'sovetydoma_yandex_oauth_state'

function loadVkIdSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.VKIDSDK) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-vkid-sdk="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('vk_sdk_load_failed')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/@vkid/sdk@2.6.5/dist-sdk/umd/index.js'
    script.async = true
    script.dataset.vkidSdk = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('vk_sdk_load_failed'))
    document.head.appendChild(script)
  })
}

function createPkceVerifier(): string {
  const bytes = new Uint8Array(48)
  window.crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

// --- Shared styles (kept here for success-state JSX that remains inline) ---
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
