'use client'

import React from 'react'
import PasswordInput from './PasswordInput'
import styles from './auth.module.css'

export interface RegisterFormProps {
  displayName: string
  registerEmail: string
  registerPassword: string
  confirmRegisterPassword: string
  emailError: string
  error: string
  info: string
  loading: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onDisplayNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onEmailBlur: () => void
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onConfirmPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onTermsChange: () => void
}

export default function RegisterForm({
  displayName,
  registerEmail,
  registerPassword,
  confirmRegisterPassword,
  emailError,
  error,
  info,
  loading,
  onSubmit,
  onDisplayNameChange,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onConfirmPasswordChange,
  onTermsChange,
}: RegisterFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className={styles.form}>
      <div>
        <label htmlFor="auth-register-name" className={styles.label}>Имя пользователя</label>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon} aria-hidden="true">👤</span>
          <input
            id="auth-register-name"
            name="displayName"
            type="text"
            value={displayName}
            onChange={onDisplayNameChange}
            required
            autoComplete="nickname"
            placeholder="Ваше имя"
            className={styles.input}
          />
        </div>
      </div>
      <div>
        <label htmlFor="auth-register-email" className={styles.label}>Email</label>
        <div className={styles.inputWrap}>
          <span className={styles.inputIcon} aria-hidden="true">📧</span>
          <input
            id="auth-register-email"
            name="email"
            type="email"
            value={registerEmail}
            onChange={onEmailChange}
            onBlur={onEmailBlur}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={styles.input}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? 'auth-register-email-error' : undefined}
          />
        </div>
        {emailError && <p id="auth-register-email-error" className={styles.error} role="alert">{emailError}</p>}
      </div>
      <div>
        <label htmlFor="auth-register-password" className={styles.label}>Пароль</label>
        <PasswordInput
          id="auth-register-password"
          name="password"
          value={registerPassword}
          onChange={onPasswordChange}
          autoComplete="new-password"
          placeholder="Минимум 8 символов"
          minLength={8}
          required
        />
      </div>
      <div>
        <label htmlFor="auth-register-password-confirm" className={styles.label}>Повторите пароль</label>
        <PasswordInput
          id="auth-register-password-confirm"
          name="confirmPassword"
          value={confirmRegisterPassword}
          onChange={onConfirmPasswordChange}
          autoComplete="new-password"
          placeholder="Повторите пароль"
          minLength={8}
          required
        />
      </div>
      <div className={styles.termsRow}>
        <input
          type="checkbox"
          id="terms"
          name="terms"
          value="accepted"
          required
          onChange={onTermsChange}
        />
        <label htmlFor="terms" style={{ lineHeight: 1.3 }}>
          Я согласен(а) с <a href="/terms" target="_blank">Условиями использования</a> и <a href="/privacy" target="_blank">Политикой конфиденциальности</a>.
        </label>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {info && <p className={styles.info} aria-live="polite">{info}</p>}
      <button type="submit" disabled={loading} className={styles.primaryButton}>
        {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
      </button>
    </form>
  )
}
