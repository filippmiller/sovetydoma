'use client'
import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

interface Props {
  slug: string
}

const REACTIONS = [
  { emoji: '👍', label: 'Полезно' },
  { emoji: '❤️', label: 'Нравится' },
  { emoji: '🔥', label: 'Огонь' },
  { emoji: '🤔', label: 'Интересно' },
]

export default function ArticleReactions({ slug }: Props) {
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0])
  const [active, setActive] = useState<boolean[]>([false, false, false, false])
  const [userId, setUserId] = useState<string | null>(null)

  // Real aggregate counts per emoji, straight from the reactions table
  // (readable by everyone via RLS). No fabricated seed numbers.
  const loadCounts = useCallback(async () => {
    try {
      const sb = getSupabase()
      const { data } = await sb.from('reactions').select('emoji').eq('article_slug', slug)
      if (data) {
        setCounts(REACTIONS.map((r) => data.filter((row: { emoji: string }) => row.emoji === r.emoji).length))
      }
    } catch {
      // unreadable — leave counts at zero
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.resolve()
      if (cancelled) return
      // Anonymous highlight state lives in localStorage so it survives reloads.
      setActive(REACTIONS.map((r) => localStorage.getItem(`reactions_${slug}_${r.emoji}_active`) === '1'))
      await loadCounts()
      try {
        const sb = getSupabase()
        const { data: u } = await sb.auth.getUser()
        const uid = u.user?.id ?? null
        if (cancelled) return
        setUserId(uid)
        if (uid) {
          const { data: rows } = await sb
            .from('reactions')
            .select('emoji')
            .eq('user_id', uid)
            .eq('article_slug', slug)
          const mine = new Set((rows || []).map((row: { emoji: string }) => row.emoji))
          if (cancelled) return
          setActive(REACTIONS.map((r) => mine.has(r.emoji)))
        }
      } catch {
        // Not configured — localStorage-only highlight.
      }
    })()
    return () => { cancelled = true }
  }, [slug, loadCounts])

  async function handleClick(index: number) {
    const r = REACTIONS[index]
    const isActive = active[index]
    const next = !isActive

    // Optimistic highlight toggle (works for everyone).
    setActive((prev) => prev.map((v, i) => (i === index ? next : v)))
    localStorage.setItem(`reactions_${slug}_${r.emoji}_active`, next ? '1' : '0')

    if (!userId) {
      // Anonymous: cannot persist (RLS requires auth). Keep counts truthful —
      // only the user's own highlight changes, the real count is untouched.
      return
    }

    // Optimistic count nudge, then write to DB and reconcile with the truth.
    setCounts((prev) => prev.map((c, i) => (i === index ? Math.max(0, c + (next ? 1 : -1)) : c)))
    try {
      const sb = getSupabase()
      if (next) {
        await sb.from('reactions').delete()
          .eq('user_id', userId).eq('article_slug', slug).eq('emoji', r.emoji)
        await sb.from('reactions').insert({ user_id: userId, article_slug: slug, emoji: r.emoji })
      } else {
        await sb.from('reactions').delete()
          .eq('user_id', userId).eq('article_slug', slug).eq('emoji', r.emoji)
      }
      loadCounts()
    } catch {
      // Revert optimistic count if the write failed.
      loadCounts()
    }
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
        {REACTIONS.map((r, i) => (
          <button
            key={r.emoji}
            onClick={() => handleClick(i)}
            aria-pressed={active[i]}
            aria-label={`${r.label}: ${counts[i]}`}
            title={!userId ? 'Войдите, чтобы ваш голос учли' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 1rem',
              borderRadius: '999px',
              border: active[i] ? '2px solid #c0392b' : '2px solid #e0dbd5',
              backgroundColor: active[i] ? '#c0392b0f' : '#faf9f7',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: active[i] ? '#c0392b' : '#555',
              transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
              minHeight: '40px',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{r.emoji}</span>
            <span>{r.label}</span>
            {counts[i] > 0 && (
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: active[i] ? '#c0392b' : '#999',
              }}>{counts[i]}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
