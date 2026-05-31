'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import { getViewCount } from '@/lib/view-counts.mjs'

interface Props {
  slug: string
}

export default function ArticleViewCount({ slug }: Props) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const sb = getSupabase()
        const { data } = await sb
          .from('feedback_counters')
          .select('article_slug, kind, count')
          .eq('article_slug', slug)
          .eq('kind', 'view')

        if (active) setCount(getViewCount(data || [], slug))
      } catch {
        if (active) setCount(0)
      }
    }

    function onRecorded(event: Event) {
      const detail = (event as CustomEvent<{ slug?: string }>).detail
      if (detail?.slug === slug) setCount((current) => (current ?? 0) + 1)
    }

    load()
    window.addEventListener('article-view-recorded', onRecorded)
    return () => {
      active = false
      window.removeEventListener('article-view-recorded', onRecorded)
    }
  }, [slug])

  if (count === null) return null

  return (
    <span title="Просмотры" style={{ whiteSpace: 'nowrap' }}>
      👁 {count}
    </span>
  )
}
