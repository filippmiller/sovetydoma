'use client'

import { useEffect, useState } from 'react'

const SIZES = [
  { label: 'A-', value: 14, title: 'Маленький шрифт' },
  { label: 'A', value: 16, title: 'Средний шрифт' },
  { label: 'A+', value: 18, title: 'Крупный шрифт' },
]

export default function FontSizeControl() {
  const [active, setActive] = useState(16)

  useEffect(() => {
    const stored = localStorage.getItem('font-size')
    const size = stored ? parseInt(stored, 10) : 16
    const valid = SIZES.find((s) => s.value === size)?.value ?? 16
    setActive(valid)
    document.documentElement.style.fontSize = `${valid}px`
  }, [])

  function setSize(value: number) {
    setActive(value)
    localStorage.setItem('font-size', String(value))
    document.documentElement.style.fontSize = `${value}px`
  }

  return (
    <div
      role="group"
      aria-label="Размер шрифта"
      style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
    >
      {SIZES.map((s) => (
        <button
          key={s.value}
          onClick={() => setSize(s.value)}
          title={s.title}
          aria-pressed={active === s.value}
          style={{
            padding: '3px 9px',
            borderRadius: '20px',
            border: `1.5px solid ${active === s.value ? '#c0392b' : '#e8e4df'}`,
            background: active === s.value ? '#c0392b' : 'transparent',
            color: active === s.value ? '#fff' : '#666',
            fontSize: s.label === 'A-' ? '0.75rem' : s.label === 'A' ? '0.85rem' : '0.95rem',
            fontWeight: 700,
            cursor: 'pointer',
            lineHeight: 1,
            transition: 'all 0.15s',
            minHeight: '28px',
            minWidth: '32px',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
