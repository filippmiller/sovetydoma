'use client'

import React from 'react'

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

export interface ForgotPasswordFormProps {
  email: string
  emailError: string
  error: string
  info: string
  loading: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onEmailBlur: () => void
  onGoBack: () => void
}

export default function ForgotPasswordForm({
  email,
  emailError,
  error,
  info,
  loading,
  onSubmit,
  onEmailChange,
  onEmailBlur,
  onGoBack,
}: ForgotPasswordFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={labelStyle}>Email</label>
        <div style={inputWrapStyle}>
          <span style={iconStyle}>📧</span>
          <input
            name="email"
            type="email"
            value={email}
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
      <p style={{ margin: 0, fontSize: '0.82rem', color: '#666', lineHeight: 1.4 }}>
        Введите email, и если аккаунт существует, мы отправим ссылку для восстановления пароля.
      </p>
      {error && <p style={errorStyle}>{error}</p>}
      {info && <p style={successTextStyle}>{info}</p>}
      <button type="submit" disabled={loading} style={btnStyle}>
        {loading ? 'Отправляем…' : 'Отправить инструкции'}
      </button>
      <button type="button" onClick={onGoBack} style={secondaryBtnStyle}>
        Назад к входу
      </button>
    </form>
  )
}
