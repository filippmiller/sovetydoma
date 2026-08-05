'use client'

import { useState } from 'react'
import type { ArticleFrontmatter } from '@/lib/articles'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'

interface Props {
  articles: (ArticleFrontmatter & { wordCount: number })[]
}

const PAGE_SIZE = 24

export default function HomepageMoreFeed({ articles }: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const visible = articles.slice(0, visibleCount)

  return (
    <>
      <ArticleCatalogGrid articles={visible} />
      {visibleCount < articles.length && (
        <div className="homepage-more-feed">
          <button type="button" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>
            Показать ещё ({articles.length - visibleCount})
          </button>
        </div>
      )}
      <style jsx>{`
        .homepage-more-feed {
          display: flex;
          justify-content: center;
          margin-top: 1.5rem;
        }
        .homepage-more-feed button {
          border: 1px solid #ded4cc;
          border-radius: 999px;
          background: #fff;
          color: #b73226;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 700;
          padding: 0.55rem 1.4rem;
          cursor: pointer;
        }
        .homepage-more-feed button:hover {
          border-color: #c0392b66;
          background: #c0392b0a;
        }
      `}</style>
    </>
  )
}
