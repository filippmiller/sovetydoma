import Link from 'next/link'
import type { ArticleFrontmatter } from '@/lib/articles'
import { findInternalLinks } from '@/lib/internal-links.mjs'

interface Props {
  source: Pick<ArticleFrontmatter, 'slug' | 'category' | 'title' | 'tags'>
  allArticles: (ArticleFrontmatter & { wordCount: number })[]
}

/**
 * Server-rendered contextual internal link mesh.
 * Placed at the end of the article body to improve crawl depth and UX.
 */
export default function ArticleInternalLinks({ source, allArticles }: Props) {
  const links = findInternalLinks(source, allArticles, 4)
  if (links.length === 0) return null

  return (
    <section aria-label="Похожие материалы" style={{ marginTop: '2.5rem' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '1rem' }}>🔗 Читайте также</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
        {links.map((link) => (
          <li key={`${link.category}/${link.slug}`}>
            <Link
              href={`/${link.category}/${link.slug}/`}
              style={{
                display: 'block',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                border: '1px solid #ece3d8',
                background: '#fbf7f2',
                color: '#1a1a1a',
                textDecoration: 'none',
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
