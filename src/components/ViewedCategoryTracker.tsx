'use client'
import { useEffect } from 'react'

interface Props {
  category: string
}

export default function ViewedCategoryTracker({ category }: Props) {
  useEffect(() => {
    try {
      const history: Record<string, number> = JSON.parse(
        localStorage.getItem('viewed_categories') || '{}'
      )
      history[category] = (history[category] || 0) + 1
      localStorage.setItem('viewed_categories', JSON.stringify(history))
    } catch {
      // localStorage unavailable
    }
  }, [category])
  return null
}
