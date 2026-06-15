'use client'

import React from 'react'
import PasswordInput from './PasswordInput'

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#555',
  marginBottom: '0.35rem',
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

export interface ResetPasswordFormProps {
  email: string
  newPassword: string
  confirmPassword: string
  error: string
  info: string
  resetLoading: boolean
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onNewPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onConfirmPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCancel: () => void
}

export default function ResetPasswordForm({
  email,
  newPassword,
  confirmPassword,
  error,
  info,
  resetLoading,
  onSubmit,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onCancel,
}: ResetPasswordFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#666' }}>
        Установите новый пароль для аккаунта {email ? email : ''}.
      </p>

      <div>
        <label style={labelStyle}>Новый пароль</label>
        <PasswordInput
          name="newPassword"
          value={newPassword}
          onChange={onNewPasswordChange}
          autoComplete="new-password"
          placeholder="Минимум 8 символов"
          required
        />
      </div>

      <div>
        <label style={labelStyle}>Повторите пароль</label>
        <PasswordInput
          name="confirmPassword"
          value={confirmPassword}
          onChange={onConfirmPasswordChange}
          autoComplete="new-password"
          placeholder="Повторите пароль"
          required
        />
      </div>

      {error && <p style={errorStyle}>{error}</p>}
      {info && <p style={successTextStyle}>{info}</p>}

      <button type="submit" disabled={resetLoading} style={btnStyle}>
        {resetLoading ? 'Сохраняем…' : 'Сохранить новый пароль'}
      </button>

      <button type="button" onClick={onCancel} style={secondaryBtnStyle}>
        Отмена
      </button>
    </form>
  )
}
