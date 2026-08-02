'use client'

import { useEffect, useState } from 'react'
import { FUN_ITEMS, type FunItem } from '@/lib/funContent'

const LABELS: Record<FunItem['type'], string> = {
  joke: '😄 Анекдот дня',
  fact: '💡 Интересный факт',
  quip: '🙂 Улыбнись',
}

// Picked from the client's own clock (not build time — this is a static
// export, so a server-computed "day of year" would freeze at whatever day
// the site last happened to be rebuilt on). `mounted` gate avoids an SSR/CSR
// mismatch, same pattern as PersonalisedSection.tsx.
export default function FunWidget() {
  const [item, setItem] = useState<FunItem | null>(null)

  useEffect(() => {
    function pickToday() {
      const now = new Date()
      const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 0))
      const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
      setItem(FUN_ITEMS[dayOfYear % FUN_ITEMS.length])
    }
    pickToday()
  }, [])

  if (!item) return null

  return (
    <section style={{
      margin: '0 0 2.5rem',
      background: 'linear-gradient(135deg, #fff8f0, #fffdfa)',
      borderRadius: '12px',
      border: '1px dashed #e8c9a0',
      padding: '1.1rem 1.4rem',
    }}>
      <div style={{
        fontSize: '0.75rem', fontWeight: 800, color: '#c0392b',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem',
      }}>
        {LABELS[item.type]}
      </div>
      <p style={{ fontSize: '0.95rem', color: '#333', lineHeight: 1.6, margin: 0 }}>
        {item.text}
      </p>
    </section>
  )
}
