'use client'

import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const dark = stored === 'dark'
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
    setMounted(true)
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }

  if (!mounted) {
    return (
      <button
        aria-label="Переключить тему"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '1.5px solid #e8e4df',
          background: 'transparent',
          fontSize: '1.2rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        🌙
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      style={{
        width: '44px',
        height: '44px',
        borderRadius: '50%',
        border: '1.5px solid #e8e4df',
        background: isDark ? '#333' : 'transparent',
        fontSize: '1.2rem',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
