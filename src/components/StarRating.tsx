'use client'

import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { promptLogin, useAuthUserId } from '@/lib/auth-gate'

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
  const [avg, setAvg] = useState<number | null>(null)
  const [voteCount, setVoteCount] = useState(0)
  const [needAuth, setNeedAuth] = useState(false)
  const { userId } = useAuthUserId()

  // Pull the public aggregate (everyone can read ratings) so we can show
  // "★ 4.6 · 12 оценок" as social proof regardless of login state.
  const loadAggregate = useCallback(async () => {
    try {
      const sb = getSupabase()
      const { data } = await sb.from('ratings').select('stars').eq('article_slug', slug)
      if (data && data.length) {
        const sum = data.reduce((acc: number, r: { stars: number }) => acc + r.stars, 0)
        setAvg(Math.round((sum / data.length) * 10) / 10)
        setVoteCount(data.length)
      } else {
        setAvg(null)
        setVoteCount(0)
      }
    } catch {
      // ratings unreadable — hide aggregate
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.resolve()
      if (cancelled) return
      await loadAggregate()

      // Load the user's own prior rating (localStorage first, then Supabase)
      const stored = localStorage.getItem(getStorageKey(slug))
      if (stored) {
        const n = parseInt(stored, 10)
        if (n >= 1 && n <= 5) {
          if (!cancelled) {
            setUserRating(n)
            setRated(true)
            setLoading(false)
          }
          return
        }
      }

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
            if (cancelled) return
            setUserRating(data.stars)
            setRated(true)
            localStorage.setItem(getStorageKey(slug), String(data.stars))
          }
        }
      } catch {
        // Table may not exist — localStorage only
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [slug, loadAggregate])

  const submitRating = async (n: number) => {
    if (!userId) {
      // Ratings require login — don't show a fake "Спасибо!", ask to sign in.
      setNeedAuth(true)
      promptLogin()
      return
    }

    setUserRating(n)
    setRated(true)
    setAnimating(n)
    setTimeout(() => setAnimating(0), 400)

    // Save to localStorage
    localStorage.setItem(getStorageKey(slug), String(n))

    // Persist to Supabase
    try {
      const sb = getSupabase()
      await sb
        .from('ratings')
        .upsert(
          { user_id: userId, article_slug: slug, stars: n },
          { onConflict: 'article_slug,user_id' }
        )
      // Refresh the public average so the user immediately sees their vote counted.
      loadAggregate()
    } catch {
      // Table not ready — localStorage fallback already saved
    }
  }

  const avgBadge = avg !== null ? (
      <span style={{ fontSize: '0.82rem', color: '#888', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#f39c12' }}>★</span> {avg.toFixed(1)} · {voteCount}{' '}
        {voteCount % 10 === 1 && voteCount % 100 !== 11 ? 'оценка' : voteCount % 10 >= 2 && voteCount % 10 <= 4 && (voteCount % 100 < 10 || voteCount % 100 >= 20) ? 'оценки' : 'оценок'}
      </span>
    ) : null

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
        {avgBadge}
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
        {avgBadge}
      </div>
      {needAuth && !userId && (
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#a93226' }}>
          <button
            onClick={() => promptLogin()}
            style={{ background: 'none', border: 'none', color: '#c0392b', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
          >
            Войдите
          </button>
          , чтобы оценить статью.
        </p>
      )}
    </div>
  )
}
