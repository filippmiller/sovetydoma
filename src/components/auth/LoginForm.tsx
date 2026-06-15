'use client'

import React from 'react'
import PasswordInput from './PasswordInput'

// Shared style constants are co-located in AuthModal.tsx and passed via the
// style props below — we re-declare them here to keep this file self-contained.

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

const dividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#aaa',
  fontSize: '0.8rem',
  margin: '-0.25rem 0',
}

export interface OAuthButtonProps {
  provider: string
  label: string
  loading: boolean
  onClick: () => void
}

function OAuthButton({ provider, label, loading, onClick }: OAuthButtonProps) {
  const colors: Record<string, string> = {
    yandex: '#fc3f1d',
    google: '#4285f4',
    vk: '#0077ff',
  }
  const bg = colors[provider] || '#666'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        width: '100%',
        padding: '0.65rem',
        background: loading ? '#e0dbd5' : bg,
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '0.9rem',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'opacity 0.2s',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? '…' : provider === 'yandex' ? 'Я' : provider === 'google' ? 'G' : 'VK'}
      {label}
    </button>
  )
}

export interface LoginFormProps {
  // Field values
  email: string
  password: string
  // Error/info state
  error: string
  info: string
  emailError: string
  loading: boolean
  // VK-related
  vkAuthEnabled: boolean
  vkLoading: boolean
  vkContainerRef: React.RefObject<HTMLDivElement | null>
  // OAuth loading state
  oauthLoading: string | null
  // Handlers
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onEmailBlur: () => void
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onGoToForgot: () => void
  onResendConfirmation: () => void
  onResending: boolean
  onYandexSignIn: () => void
  onOAuthSignIn: (provider: 'google' | 'vk') => void
}

export default function LoginForm({
  email,
  password,
  error,
  info,
  emailError,
  loading,
  vkAuthEnabled,
  vkLoading,
  vkContainerRef,
  oauthLoading,
  onSubmit,
  onEmailChange,
  onEmailBlur,
  onPasswordChange,
  onGoToForgot,
  onResendConfirmation,
  onResending,
  onYandexSignIn,
  onOAuthSignIn,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {vkAuthEnabled && (
        <>
          <div ref={vkContainerRef} style={{ opacity: vkLoading ? 0.6 : 1 }} />
          <div style={dividerStyle}><span>или</span></div>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <OAuthButton
          provider="yandex"
          label="Войти через Яндекс"
          loading={oauthLoading === 'yandex'}
          onClick={onYandexSignIn}
        />
        <OAuthButton
          provider="google"
          label="Войти через Google"
          loading={oauthLoading === 'google'}
          onClick={() => onOAuthSignIn('google')}
        />
        <OAuthButton
          provider="vk"
          label="Войти через VK"
          loading={oauthLoading === 'vk'}
          onClick={() => onOAuthSignIn('vk')}
        />
      </div>
      <div style={dividerStyle}><span>или email</span></div>
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
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <label style={labelStyle}>Пароль</label>
          <button
            type="button"
            onClick={onGoToForgot}
            style={{
              background: 'none',
              border: 'none',
              color: '#c0392b',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Забыли пароль?
          </button>
        </div>
        <PasswordInput
          name="password"
          value={password}
          onChange={onPasswordChange}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </div>
      {error && <p style={errorStyle}>{error}</p>}
      {info && <p style={successTextStyle}>{info}</p>}
      <button type="submit" disabled={loading} style={btnStyle}>
        {loading ? 'Входим…' : 'Войти'}
      </button>
      {error.includes('Email ещё не подтверждён') && (
        <button type="button" onClick={onResendConfirmation} disabled={onResending} style={{ ...secondaryBtnStyle }}>
          {onResending ? 'Отправляем...' : 'Отправить письмо подтверждения ещё раз'}
        </button>
      )}
    </form>
  )
}
