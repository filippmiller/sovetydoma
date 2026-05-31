'use client'

import { useEffect } from 'react'
import { getSupabase } from '@/lib/supabase'
import { getArticleViewStorageKey } from '@/lib/view-counts.mjs'

interface Props {
  slug: string
}

export default function ViewTracker({ slug }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const key = getArticleViewStorageKey(slug)
        if (localStorage.getItem(key) === '1') return
        localStorage.setItem(key, '1')

        const sb = getSupabase()
        let userId: string | null = null
        try {
          const { data } = await sb.auth.getUser()
          userId = data.user?.id ?? null
        } catch {}

        await sb.from('feedback_events').insert({
          article_slug: slug,
          kind: 'view',
          comment: '',
          user_id: userId,
        })

        window.dispatchEvent(new CustomEvent('article-view-recorded', { detail: { slug } }))
      } catch {
        // Views are best-effort; never block reading the article.
      }
    }, 8000)

    return () => window.clearTimeout(timer)
  }, [slug])

  return null
}
