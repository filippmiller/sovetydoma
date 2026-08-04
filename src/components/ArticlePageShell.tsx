import type { ReactNode } from 'react'
import FeedLeftNav from '@/components/FeedLeftNav'

/**
 * Universal navigation frame for all public pages.
 * Provides the left sidebar with navigation on desktop and
 * horizontal scroll on mobile.
 */
export default function ArticlePageShell({ children }: { children: ReactNode }) {
  return (
    <div className="article-page-shell">
      <aside className="article-page-rail">
        <FeedLeftNav />
      </aside>
      <div className="article-page-content">{children}</div>
    </div>
  )
}
