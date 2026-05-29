'use client'
import { useEffect, useState } from 'react'

interface Props {
  slug: string
}

const REACTIONS = [
  { emoji: '👍', label: 'Полезно' },
  { emoji: '❤️', label: 'Нравится' },
  { emoji: '🔥', label: 'Огонь' },
  { emoji: '🤔', label: 'Интересно' },
]

const MULTIPLIERS = [7, 11, 5, 9]

function seedCount(slug: string, index: number): number {
  return (slug.length * MULTIPLIERS[index]) % 30 + 3
}

export default function ArticleReactions({ slug }: Props) {
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0])
  const [active, setActive] = useState<boolean[]>([false, false, false, false])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const newCounts = REACTIONS.map((r, i) => {
      const stored = localStorage.getItem(`reactions_${slug}_${r.emoji}`)
      const seed = seedCount(slug, i)
      return stored !== null ? parseInt(stored, 10) : seed
    })
    const newActive = REACTIONS.map((r) => {
      return localStorage.getItem(`reactions_${slug}_${r.emoji}_active`) === '1'
    })
    setCounts(newCounts)
    setActive(newActive)
    setMounted(true)
  }, [slug])

  function handleClick(index: number) {
    const r = REACTIONS[index]
    const isActive = active[index]
    const seed = seedCount(slug, index)
    const storedRaw = localStorage.getItem(`reactions_${slug}_${r.emoji}`)
    const current = storedRaw !== null ? parseInt(storedRaw, 10) : seed
    const next = isActive ? Math.max(0, current - 1) : current + 1

    localStorage.setItem(`reactions_${slug}_${r.emoji}`, String(next))
    localStorage.setItem(`reactions_${slug}_${r.emoji}_active`, isActive ? '0' : '1')

    setCounts((prev) => {
      const updated = [...prev]
      updated[index] = next
      return updated
    })
    setActive((prev) => {
      const updated = [...prev]
      updated[index] = !isActive
      return updated
    })
  }

  if (!mounted) return null

  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
      {REACTIONS.map((r, i) => (
        <button
          key={r.emoji}
          onClick={() => handleClick(i)}
          aria-pressed={active[i]}
          aria-label={`${r.label}: ${counts[i]}`}
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
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: active[i] ? '#c0392b' : '#999',
          }}>{counts[i]}</span>
        </button>
      ))}
    </div>
  )
}
