'use client'

import { useState } from 'react'

interface Props {
  url: string
  title: string
  compact?: boolean
}

export default function CardShareButton({ url, title, compact = true }: Props) {
  const [copied, setCopied] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // cancelled or not supported
      }
    }

    // fallback copy
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setShowHint(true)
      setTimeout(() => {
        setCopied(false)
        setShowHint(false)
      }, 1600)
    } catch {
      // very old fallback
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setShowHint(true)
      setTimeout(() => { setCopied(false); setShowHint(false) }, 1600)
    }
  }

  const label = 'Поделиться статьёй'

  return (
    <div style={{ position: 'relative', zIndex: 3 }}>
      <button
        onClick={handleShare}
        aria-label={label}
        title={label}
        style={{
          position: 'absolute',
          top: compact ? '0.75rem' : '0.6rem',
          right: compact ? '3.1rem' : '3.3rem',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.14)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.95rem',
          padding: 0,
          zIndex: 3,
          transition: 'transform 0.12s ease, background 0.12s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <span aria-hidden="true">🔗</span>
      </button>

      {showHint && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: '2.35rem',
            right: '0.1rem',
            background: copied ? '#e6f4ea' : '#f5f2ed',
            color: copied ? '#1e7a3d' : '#555',
            fontSize: '0.72rem',
            padding: '2px 7px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {copied ? 'Ссылка скопирована' : 'Копируем...'}
        </div>
      )}
    </div>
  )
}
