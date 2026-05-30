'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

interface Props {
  slug: string
}

function getStorageKey(slug: string) {
  return `rating_${slug}`
}

export default function StarRating({ slug }: Props) {
  const [rated, setRated] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [animating, setAnimating] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem(getStorageKey(slug))
    if (stored) {
      const n = parseInt(stored, 10)
      if (n >= 1 && n <= 5) {
        setUserRating(n)
        setRated(true)
        setLoading(false)
        return
      }
    }

    // Try Supabase
    ;(async () => {
      try {
        const sb = getSupabase()
        const { data: user } = await sb.auth.getUser()
        if (user.user) {
          const { data } = await sb
            .from('ratings')
            .select('stars')
            .eq('user_id', user.user.id)
            .eq('article_slug', slug)
            .maybeSingle()
          if (data?.stars) {
            setUserRating(data.stars)
            setRated(true)
            localStorage.setItem(getStorageKey(slug), String(data.stars))
          }
        }
      } catch {
        // Table may not exist — localStorage only
      }
      setLoading(false)
    })()
  }, [slug])

  const submitRating = async (n: number) => {
    setUserRating(n)
    setRated(true)
    setAnimating(n)
    setTimeout(() => setAnimating(0), 400)

    // Save to localStorage
    localStorage.setItem(getStorageKey(slug), String(n))

    // Try Supabase
    try {
      const sb = getSupabase()
      const { data: user } = await sb.auth.getUser()
      if (user.user) {
        await sb
          .from('ratings')
          .upsert(
            { user_id: user.user.id, article_slug: slug, stars: n },
            { onConflict: 'article_slug,user_id' }
          )
      }
    } catch {
      // Table not ready — localStorage fallback already saved
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '4px',
              background: '#f0ede8',
            }}
          />
        ))}
      </div>
    )
  }

  if (rated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              style={{
                fontSize: '28px',
                color: i <= userRating ? '#f39c12' : '#ddd',
                lineHeight: 1,
              }}
            >
              ★
            </span>
          ))}
        </div>
        <span style={{ fontSize: '0.85rem', color: '#888', fontStyle: 'italic' }}>
          Ваша оценка: {userRating}/5 · Спасибо!
        </span>
      </div>
    )
  }

  const displayRating = hovered || 0

  return (
    <div>
      <style>{`
        @keyframes starPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.88rem', color: '#666', fontWeight: 600 }}>
          Оцените статью:
        </span>
        <div
          style={{ display: 'flex', gap: '4px' }}
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              onMouseEnter={() => setHovered(i)}
              onClick={() => submitRating(i)}
              aria-label={`Оценить на ${i} из 5`}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontSize: '28px',
                color: i <= displayRating ? '#f39c12' : '#ccc',
                transition: 'color 0.1s ease',
                animation: animating === i ? 'starPop 0.4s ease' : 'none',
                lineHeight: 1,
              }}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
