'use client'

import { useState, useEffect } from 'react'

interface ArticleChecklistProps {
  items: string[]
  id: string
}

export default function ArticleChecklist({ items, id }: ArticleChecklistProps) {
  const storageKey = `checklist_${id}`
  const [checked, setChecked] = useState<boolean[]>([])

  // Load from localStorage on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.resolve()
      if (cancelled) return
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          const parsed = JSON.parse(stored) as boolean[]
          // Ensure length matches items in case items changed
          const normalized = items.map((_, i) => parsed[i] ?? false)
          if (!cancelled) setChecked(normalized)
        } else if (!cancelled) {
          setChecked(items.map(() => false))
        }
      } catch {
        if (cancelled) return
        setChecked(items.map(() => false))
      }
    })()
    return () => { cancelled = true }
  }, [storageKey, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage on change
  useEffect(() => {
    if (checked.length === 0) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(checked))
    } catch {
      // localStorage unavailable — silent fail
    }
  }, [checked, storageKey])

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })
  }

  const reset = () => {
    const cleared = items.map(() => false)
    setChecked(cleared)
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // silent
    }
  }

  const anyChecked = checked.some(Boolean)

  return (
    <div style={{
      border: '1px solid #e8e4df',
      borderRadius: '10px',
      padding: '1.25rem 1.5rem',
      margin: '1.5rem 0',
      background: '#faf8f5',
    }}>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item, index) => {
          const isChecked = checked[index] ?? false
          return (
            <li key={index} style={{ marginBottom: '0.6rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                cursor: 'pointer',
                userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(index)}
                  style={{
                    marginTop: '3px',
                    width: '18px',
                    height: '18px',
                    accentColor: '#c0392b',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
                <span style={{
                  fontSize: '1rem',
                  lineHeight: 1.6,
                  color: isChecked ? '#aaa' : '#333',
                  textDecoration: isChecked ? 'line-through' : 'none',
                  opacity: isChecked ? 0.6 : 1,
                  transition: 'color 0.2s, opacity 0.2s',
                }}>
                  {item}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {anyChecked && (
        <button
          onClick={reset}
          style={{
            marginTop: '0.85rem',
            background: 'none',
            border: '1px solid #ddd',
            borderRadius: '5px',
            padding: '4px 12px',
            fontSize: '0.82rem',
            color: '#888',
            cursor: 'pointer',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            const btn = e.currentTarget
            btn.style.borderColor = '#c0392b'
            btn.style.color = '#c0392b'
          }}
          onMouseLeave={(e) => {
            const btn = e.currentTarget
            btn.style.borderColor = '#ddd'
            btn.style.color = '#888'
          }}
        >
          Сбросить
        </button>
      )}
    </div>
  )
}
