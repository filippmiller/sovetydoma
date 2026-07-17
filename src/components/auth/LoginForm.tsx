'use client'

import React from 'react'
import PasswordInput from './PasswordInput'
import styles from './auth.module.css'

// Email login form. Social sign-in (VK ID / Яндекс ID / Google) lives in
// SocialAuthSection and is rendered by AuthModal above this form — the flows
// are identical for login and registration, so they are not duplicated here.

export interface LoginFormProps {
  // Field values
  email: string
  password: string
  // Error/info state
  error: string
  info: string
  emailError: string
  loading: boolean
  // Handlers
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onEmailBlur: () => void
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onGoToForgot: () => void
  onResendConfirmation: () => void
  onResending: boolean
}

export default function LoginForm({
  email,
  password,
  error,
  info,
  emailError,
  loading,
  onSubmit,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onGoToForgot,
  onResendConfirmation,
  onResending,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className={styles.form}>
      <div>
        <label htmlFor="auth-login-email" className={styles.label}>Email</label>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon} aria-hidden="true">📧</span>
          <input
            id="auth-login-email"
            name="email"
            type="email"
            value={email}
            onChange={onEmailChange}
            onBlur={onEmailBlur}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={styles.input}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? 'auth-login-email-error' : undefined}
          />
        </div>
        {emailError && <p id="auth-login-email-error" className={styles.error} role="alert">{emailError}</p>}
      </div>
      <div>
        <div className={styles.labelRow}>
          <label htmlFor="auth-login-password" className={styles.label}>Пароль</label>
          <button
            type="button"
            onClick={onGoToForgot}
            className={styles.forgotLink}
          >
            Забыли пароль?
          </button>
        </div>
        <PasswordInput
          id="auth-login-password"
          name="password"
          value={password}
          onChange={onPasswordChange}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {info && <p className={styles.info} aria-live="polite">{info}</p>}
      <button type="submit" disabled={loading} className={styles.primaryButton}>
        {loading ? 'Входим…' : 'Войти'}
      </button>
      {error.includes('Email ещё не подтверждён') && (
        <button type="button" onClick={onResendConfirmation} disabled={onResending} className={styles.secondaryButton}>
          {onResending ? 'Отправляем...' : 'Отправить письмо подтверждения ещё раз'}
        </button>
      )}
    </form>
  )
}
