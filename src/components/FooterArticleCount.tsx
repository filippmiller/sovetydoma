'use client'

import { useEffect, useState } from 'react'

function pluralArticles(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'статья'
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'статьи'
  return 'статей'
}

const COUNT_URL = 'https://sovetydoma-photo-upload.filippmiller.workers.dev/article-count'

/**
 * Footer article total. getAllArticles() only counts the static MDX corpus
 * (~486); ~2200 more are published dynamically from content_matrix. On static
 * pages this client component folds the published-dynamic count in on mount.
 * On dynamic (renderer-served) pages hydration is stripped, so the renderer
 * injects an equivalent vanilla script (buildFooterCountHtml) that updates the
 * same #site-article-total / #site-article-word nodes this component renders.
 */
export default function FooterArticleCount({ staticCount }: { staticCount: number }) {
  const [total, setTotal] = useState(staticCount)

  useEffect(() => {
    let cancelled = false
    fetch(COUNT_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { published?: number } | null) => {
        if (!cancelled && d && typeof d.published === 'number' && d.published > 0) {
          setTotal(staticCount + d.published)
        }
      })
      .catch(() => { /* keep the static fallback */ })
    return () => { cancelled = true }
  }, [staticCount])

  return (
    <>
      <span id="site-article-total" data-static={staticCount}>{total}</span>{' '}
      <span id="site-article-word">{pluralArticles(total)}</span>
    </>
  )
}
