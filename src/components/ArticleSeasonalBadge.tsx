'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Props {
  seasonalMonths?: number[]
}

const MONTH_NAMES = [
  'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
  'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре',
]

/**
 * Client-only "в сезоне сейчас" badge.
 * Avoids hydration mismatch by computing the current month in useEffect.
 */
export default function ArticleSeasonalBadge({ seasonalMonths }: Props) {
  const [nowMonth, setNowMonth] = useState<number | null>(null)

  useEffect(() => {
    // Client-only: avoids hydration mismatch for a month-based badge.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMonth(new Date().getMonth() + 1)
  }, [])

  if (!nowMonth || !seasonalMonths?.includes(nowMonth)) return null

  return (
    <Link
      href={`/sezon/${nowMonth}/`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        fontSize: '0.78rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: '#16a085',
        background: '#e8f8f5',
        border: '1px solid #a9dfbf',
        borderRadius: '999px',
        padding: '0.25rem 0.7rem',
        textDecoration: 'none',
      }}
    >
      🌿 В сезоне сейчас ({MONTH_NAMES[nowMonth - 1]})
    </Link>
  )
}
