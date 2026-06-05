'use client'

import React, { useState } from 'react'

interface PasswordInputProps {
  id?: string
  name?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  disabled?: boolean
  minLength?: number
  style?: React.CSSProperties
  inputStyle?: React.CSSProperties
  'aria-describedby'?: string
}

export default function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  required = true,
  disabled = false,
  minLength,
  style,
  inputStyle,
  ...rest
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  const baseInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '0.65rem 0.75rem 0.65rem 0.25rem',
    border: 'none',
    background: 'transparent',
    fontSize: '0.95rem',
    outline: 'none',
    width: '100%',
    fontFamily: 'inherit',
    ...inputStyle,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e0dbd5', borderRadius: '8px', overflow: 'hidden', background: '#faf9f7', ...style }}>
      <span style={{ padding: '0 0.5rem 0 0.75rem', fontSize: '1rem', userSelect: 'none', flexShrink: 0 }}>🔒</span>
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        minLength={minLength}
        style={baseInputStyle}
        aria-describedby={rest['aria-describedby']}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        disabled={disabled}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        style={{ background: 'none', border: 'none', padding: '0 0.75rem', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '1rem', opacity: disabled ? 0.5 : 1 }}
      >
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  )
}
