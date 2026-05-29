'use client'

import { useEffect } from 'react'

interface Props {
  slug: string
}

export default function ViewTracker({ slug }: Props) {
  useEffect(() => {
    try {
      const key = `views_${slug}`
      const count = parseInt(localStorage.getItem(key) || '0', 10) + 1
      localStorage.setItem(key, String(count))
    } catch {
      // localStorage might be unavailable (private mode, etc.) — silently ignore
    }
  }, [slug])

  return null
}
