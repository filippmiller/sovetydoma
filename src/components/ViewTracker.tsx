'use client'

import { useEffect } from 'react'
import { getArticleViewStorageKey } from '@/lib/view-counts.mjs'

interface Props {
  slug: string
}
const VIEW_WORKER = (
  process.env.NEXT_PUBLIC_VIEW_WORKER_URL
  || process.env.NEXT_PUBLIC_CONTACT_WORKER_URL
  || process.env.NEXT_PUBLIC_PHOTO_WORKER_URL
  || ''
).replace(/\/+$/, '')

export default function ViewTracker({ slug }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const key = getArticleViewStorageKey(slug)
        if (localStorage.getItem(key) === '1') return
        if (!VIEW_WORKER) return

        const res = await fetch(`${VIEW_WORKER}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_slug: slug }),
        })
        if (!res.ok) return

        localStorage.setItem(key, '1')
        window.dispatchEvent(new CustomEvent('article-view-recorded', { detail: { slug } }))
      } catch {
        // Views are best-effort; never block reading the article.
      }
    }, 8000)

    return () => window.clearTimeout(timer)
  }, [slug])

  return null
}
