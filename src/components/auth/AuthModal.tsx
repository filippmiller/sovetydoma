'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { migrateLocalFavoritesToServer, processPendingFavoriteIntent } from '@/lib/favorites'
import { mapAuthError } from '@/lib/auth/error-messages'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import ForgotPasswordForm from './ForgotPasswordForm'
import ResetPasswordForm from './ResetPasswordForm'
import SocialAuthSection, { type SocialProvider } from './SocialAuthSection'
import styles from './auth.module.css'

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
  /** Open directly in password-reset mode (user arrived via a recovery link). */
  forceReset?: boolean
}

export default function AuthModal({ isOpen, onClose, initialTab = 'login', reason, forceReset = false }: Props) {
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
  const [confirmRegisterPassword, setConfirmRegisterPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<SocialProvider | null>(null)

  // ── Social flows ──────────────────────────────────────────────────────────
  // VK ID and Yandex ID run as redirect-based authorization-code flows (no
  // third-party SDK, no iframes): browser → provider consent → our callback →
  // worker exchange → Supabase session.

  // VK ID: OAuth 2.1 + PKCE against id.vk.com/authorize. The PKCE verifier and
  // the CSRF state are stored in sessionStorage and verified by the static
  // callback page (/api/auth/vk/callback) before the worker exchange.
  const handleVkSignIn = useCallback(async () => {
    setError('')
    const appId = (process.env.NEXT_PUBLIC_VK_APP_ID || '').trim()
    if (!appId) {
      // Fail closed: never silently fall back to a hardcoded app id.
      setError('Вход через VK ID пока не настроен. Попробуйте войти по email.')
      return
    }
    setOauthLoading('vk')
    try {
      const codeVerifier = createPkceVerifier()
      const codeChallenge = await createPkceChallenge(codeVerifier)
      if (!codeChallenge) throw new Error('pkce_unavailable')
      const state = createPkceVerifier()
      window.sessionStorage.setItem(VK_ID_CODE_VERIFIER_KEY, codeVerifier)
      window.sessionStorage.setItem(VK_OAUTH_STATE_KEY, state)
      window.sessionStorage.setItem('auth_redirect_to', getAuthRedirectTo())
      const authorizeUrl = new URL('https://id.vk.com/authorize')
      authorizeUrl.searchParams.set('response_type', 'code')
      authorizeUrl.searchParams.set('client_id', appId)
      authorizeUrl.searchParams.set('redirect_uri', `${window.location.origin}/api/auth/vk/callback`)
      authorizeUrl.searchParams.set('code_challenge', codeChallenge)
      authorizeUrl.searchParams.set('code_challenge_method', 'S256')
      authorizeUrl.searchParams.set('state', state)
      authorizeUrl.searchParams.set('scope', (process.env.NEXT_PUBLIC_VK_SCOPE || 'email').trim() || 'email')
      window.location.href = authorizeUrl.toString()
    } catch {
      setError('Не удалось начать вход через VK ID. Попробуйте ещё раз или войдите по email.')
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

  const vkAuthEnabled = process.env.NEXT_PUBLIC_VK_AUTH_ENABLED === 'true' && Boolean((process.env.NEXT_PUBLIC_VK_APP_ID || '').trim())
  const yandexAuthEnabled = Boolean((process.env.NEXT_PUBLIC_YANDEX_OAUTH_CLIENT_ID || '').trim())

  // ── Lifecycle / a11y ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return
    const resetId = window.setTimeout(() => {
      setError('')
      setInfo('')
      setEmailError('')
      setSuccess(null)
      setTab(initialTab)
      // Recovery link → open straight on the "set new password" form, otherwise login.
      setMode(forceReset ? 'reset' : 'login')
      setEmail('')
      setPassword('')
      setRegisterEmail('')
      setRegisterPassword('')
      setDisplayName('')
      setConfirmRegisterPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setOauthLoading(null)
    }, 0)
    return () => window.clearTimeout(resetId)
  }, [isOpen, initialTab, forceReset])

  // Focus management: remember the trigger, move focus inside on open,
  // trap Tab inside the dialog, restore focus on close.
  useEffect(() => {
    if (!isOpen) {
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
      return
    }
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const focusId = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      first?.focus()
    }, 0)

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.clearTimeout(focusId)
      window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

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
    // Ensure the recovery session is active on the client this call uses BEFORE
    // updateUser. Otherwise updateUser can fail locally ("Auth session missing",
    // no network call) if the recovery session wasn't carried into this client
    // instance. Recovery tokens live in the URL hash; setSession is idempotent.
    try {
      const hp = new URLSearchParams((typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, ''))
      const at = hp.get('access_token')
      const rt = hp.get('refresh_token')
      if (at && rt) await supabase.auth.setSession({ access_token: at, refresh_token: rt })
    } catch { /* fall through — updateUser will surface any real failure */ }
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

  const socialSection = (
    <SocialAuthSection
      vkEnabled={vkAuthEnabled}
      yandexEnabled={yandexAuthEnabled}
      loadingProvider={oauthLoading}
      onVkSignIn={() => { void handleVkSignIn() }}
      onYandexSignIn={handleYandexSignIn}
    />
  )

  const titleText = mode === 'forgot' ? 'Восстановить пароль' : (tab === 'login' ? 'Вход в СоветыДома' : 'Регистрация')
  const subtitleText = reason
    ? reason
    : mode === 'forgot'
      ? 'Мы отправим ссылку для сброса пароля, если такой аккаунт существует'
      : tab === 'login'
        ? 'Сохраняйте статьи, оставляйте комментарии'
        : 'Присоединяйтесь — это бесплатно'

  // Render through a portal to <body> so the fixed overlay is never trapped
  // by an ancestor's containing block (e.g. a card's transform/overflow).
  return createPortal(
    <div
      ref={overlayRef}
      className={styles.overlay}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-desc"
      >
        {/* Close button */}
        <button onClick={onClose} aria-label="Закрыть" className={styles.closeButton}>
          ×
        </button>

        {/* Title */}
        <h2 id="auth-modal-title" className={styles.title}>{titleText}</h2>

        {/* Benefit subtitle (or contextual reason if the modal was invoked from an action) */}
        <p id="auth-modal-desc" className={reason ? styles.subtitleReason : styles.subtitle}>
          {subtitleText}
        </p>

        {/* Tab switcher — pill style (hidden during forgot/reset flows) */}
        {mode !== 'forgot' && mode !== 'reset' && (
          <div className={styles.tabs} role="tablist" aria-label="Вход или регистрация">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => switchTab(t)}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              >
                {t === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </button>
            ))}
          </div>
        )}

        {/* Success states */}
        {success === 'welcome' && (
          <div className={styles.welcome}>
            🎉 Добро пожаловать!
          </div>
        )}

        {success === 'verify' && (
          <div className={styles.successCard}>
            <div className={styles.successIcon}>📧</div>
            <p className={styles.successTitle}>
              Проверьте почту для подтверждения аккаунта
            </p>
            <p className={styles.successText}>
              Мы отправили письмо на <strong>{registerEmail}</strong>. Перейдите по ссылке в письме.
            </p>
            <p className={styles.successText}>
              Если письма нет несколько минут — проверьте папку «Спам».
            </p>
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resending || resendCooldown > 0}
              className={styles.primaryButton}
              style={{ marginTop: '0.5rem', width: '100%' }}
            >
              {resending ? 'Отправляем...' : (resendCooldown > 0 ? `Отправить ещё раз (${resendCooldown}с)` : 'Отправить письмо ещё раз')}
            </button>
            <div className={styles.buttonRow} style={{ marginTop: '0.6rem' }}>
              <button
                type="button"
                onClick={() => {
                  // Allow editing email: go back to register form with current email
                  setSuccess(null)
                  setTab('register')
                  setMode('login')
                }}
                className={styles.secondaryButton}
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
                className={styles.secondaryButton}
              >
                Назад к входу
              </button>
            </div>
            {info && <p className={styles.info} style={{ marginTop: '0.7rem' }} aria-live="polite">{info}</p>}
            {error && <p className={styles.error} style={{ marginTop: '0.7rem' }} role="alert">{error}</p>}
          </div>
        )}

        {success === 'forgot-sent' && (
          <div className={styles.successCard}>
            <div className={styles.successIcon}>📧</div>
            <p className={styles.successTitle}>
              Если аккаунт с таким email существует, мы отправили инструкции по восстановлению пароля.
            </p>
            <p className={styles.successText}>
              Проверьте почту (включая папку «Спам»).
            </p>
            <button type="button" onClick={goBackToLogin} className={styles.secondaryButton} style={{ marginTop: '1rem', width: '100%' }}>
              Вернуться к входу
            </button>
          </div>
        )}

        {success === 'reset-success' && (
          <div className={styles.successCard}>
            <div className={styles.successIcon}>✅</div>
            <p className={styles.successTitle}>
              Пароль успешно изменён
            </p>
            <p className={styles.successText}>
              Теперь вы можете войти с новым паролем.
            </p>
            <div className={styles.buttonRow} style={{ marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setSuccess(null)
                  setMode('login')
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className={styles.secondaryButton}
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
                className={styles.primaryButton}
              >
                В личный кабинет
              </button>
            </div>
          </div>
        )}

        {/* Login: social section + email form */}
        {!success && tab === 'login' && mode === 'login' && (
          <>
            {socialSection}
            {(vkAuthEnabled || yandexAuthEnabled) && (
              <div className={styles.divider}><span>или с email</span></div>
            )}
            <LoginForm
              email={email}
              password={password}
              error={error}
              info={info}
              emailError={emailError}
              loading={loading}
              onSubmit={handleLogin}
              onEmailChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError('') }}
              onEmailBlur={() => { if (email && !isValidEmail(email)) setEmailError('Введите корректный email адрес.') }}
              onPasswordChange={(e) => setPassword(e.target.value)}
              onGoToForgot={goToForgot}
              onResendConfirmation={resendConfirmation}
              onResending={resending}
            />
          </>
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

        {/* Register: social section + email form */}
        {!success && tab === 'register' && (
          <>
            {socialSection}
            {(vkAuthEnabled || yandexAuthEnabled) && (
              <div className={styles.divider}><span>или с email</span></div>
            )}
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
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

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

const VK_ID_CODE_VERIFIER_KEY = 'sovetydoma_vk_id_code_verifier'
const VK_OAUTH_STATE_KEY = 'sovetydoma_vk_oauth_state'
const YANDEX_STATE_KEY = 'sovetydoma_yandex_oauth_state'

function createPkceVerifier(): string {
  const bytes = new Uint8Array(48)
  window.crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function createPkceChallenge(verifier: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
