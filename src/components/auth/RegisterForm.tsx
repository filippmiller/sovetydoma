'use client'

import React from 'react'
import PasswordInput from './PasswordInput'

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
    <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={labelStyle}>Имя пользователя</label>
        <div style={inputWrapStyle}>
          <span style={iconStyle}>👤</span>
          <input
            name="displayName"
            type="text"
            value={displayName}
            onChange={onDisplayNameChange}
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
            name="email"
            type="email"
            value={registerEmail}
            onChange={onEmailChange}
            onBlur={onEmailBlur}
            required
            autoComplete="email"
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>
        {emailError && <p style={errorStyle}>{emailError}</p>}
      </div>
      <div>
        <label style={labelStyle}>Пароль</label>
        <PasswordInput
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
        <label style={labelStyle}>Повторите пароль</label>
        <PasswordInput
          name="confirmPassword"
          value={confirmRegisterPassword}
          onChange={onConfirmPasswordChange}
          autoComplete="new-password"
          placeholder="Повторите пароль"
          minLength={8}
          required
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: '#555' }}>
        <input
          type="checkbox"
          id="terms"
          name="terms"
          value="accepted"
          required
          style={{ marginTop: '0.2rem' }}
          onChange={onTermsChange}
        />
        <label htmlFor="terms" style={{ lineHeight: 1.3 }}>
          Я согласен(а) с <a href="/terms" target="_blank" style={{ color: '#c0392b' }}>Условиями использования</a> и <a href="/privacy" target="_blank" style={{ color: '#c0392b' }}>Политикой конфиденциальности</a>.
        </label>
      </div>
      {error && <p style={errorStyle}>{error}</p>}
      {info && <p style={successTextStyle}>{info}</p>}
      <button type="submit" disabled={loading} style={btnStyle}>
        {loading ? 'Регистрируем…' : 'Зарегистрироваться'}
      </button>
    </form>
  )
}
