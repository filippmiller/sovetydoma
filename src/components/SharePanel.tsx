'use client'

import { useEffect, useState } from 'react'

interface Props {
  url: string
  title: string
}

export default function SharePanel({ url, title }: Props) {
  const [copied, setCopied] = useState(false)
  const [hasNativeShare, setHasNativeShare] = useState(false)

  useEffect(() => {
    Promise.resolve().then(() => setHasNativeShare(typeof navigator !== 'undefined' && !!navigator.share))
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, url })
    } catch {
      // User cancelled or not supported
    }
  }

  const vkUrl = `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`

  return (
    <div style={{
      border: '1.5px solid #e8e4df',
      borderRadius: '14px',
      background: '#ffffff',
      padding: '1.5rem',
      marginTop: '2.5rem',
    }}>
      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>
          Поделиться статьёй
        </h3>
      </div>

      {/* ROW 1: Copy link */}
      <button
        onClick={handleCopy}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.65rem 1rem',
          border: `1.5px solid ${copied ? '#27ae60' : '#d1ccc6'}`,
          borderRadius: '8px',
          background: copied ? '#f0fff4' : '#faf9f7',
          color: copied ? '#27ae60' : '#555',
          fontSize: '0.92rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          marginBottom: '1rem',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        {copied ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            ✓ Ссылка скопирована!
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Скопировать ссылку
          </>
        )}
      </button>

      {/* ROW 2: Platform buttons */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: hasNativeShare ? '1rem' : 0 }}>
        {/* VKontakte */}
        <a
          href={vkUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            border: '1.5px solid #c5d9ef',
            background: '#eef4fb',
            color: '#4a76a8',
            fontSize: '0.88rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#4a76a8">
            <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93v6.14C2 20.67 3.33 22 8.93 22h6.14C20.67 22 22 20.67 22 15.07V8.93C22 3.33 20.67 2 15.07 2zm2.07 13.5h-1.31c-.5 0-.65-.4-1.54-1.3-.77-.75-1.1-.85-1.29-.85-.26 0-.33.07-.33.43v1.18c0 .31-.1.5-1.05.5-1.54 0-3.24-.93-4.45-2.67-1.8-2.53-2.29-4.43-2.29-4.82 0-.19.07-.37.43-.37h1.31c.32 0 .44.15.57.5.62 1.79 1.67 3.36 2.1 3.36.16 0 .23-.07.23-.46V9.63c-.05-.83-.47-.9-.47-1.2 0-.14.11-.29.29-.29h2.06c.27 0 .37.14.37.45v2.43c0 .27.12.37.2.37.16 0 .3-.1.6-.4 .93-1.04 1.59-2.64 1.59-2.64.09-.19.24-.37.56-.37h1.31c.39 0 .48.2.39.49-.16.74-1.72 2.95-1.72 2.95-.14.22-.19.32 0 .57.13.19.58.57.87.91.54.6.96 1.11.96 1.46 0 .32-.28.5-.57.5z"/>
          </svg>
          ВКонтакте
        </a>

        {/* Telegram */}
        <a
          href={tgUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            border: '1.5px solid #b3ddf5',
            background: '#e8f6fd',
            color: '#229ED9',
            fontSize: '0.88rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#229ED9">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8-1.69 7.97c-.12.58-.46.72-.93.45l-2.57-1.9-1.24 1.19c-.14.14-.26.26-.52.26l.18-2.62 4.72-4.26c.21-.18-.04-.28-.32-.1L7.54 14.53l-2.52-.79c-.55-.17-.56-.55.11-.82l9.85-3.8c.46-.17.86.11.66.68z"/>
          </svg>
          Telegram
        </a>

        {/* WhatsApp */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            border: '1.5px solid #b3e8c8',
            background: '#e8faf0',
            color: '#25D366',
            fontSize: '0.88rem',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
      </div>

      {/* ROW 3: Native Web Share (mobile only) */}
      {hasNativeShare && (
        <button
          onClick={handleNativeShare}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
            border: '1.5px solid #e0dbd5',
            borderRadius: '8px',
            background: '#f5f3f0',
            color: '#555',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.2s',
          }}
        >
          📤 Поделиться через телефон
        </button>
      )}
    </div>
  )
}
