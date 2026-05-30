import Link from 'next/link'
import type { ArticleFrontmatter } from '@/lib/articles'

interface Props {
  allArticles: ArticleFrontmatter[]
  currentSlug: string
  category: string
  tags: string[]
}

/**
 * "Связанные темы" — a derived topic cluster. Picks the article's most
 * distinctive shared tag and lists other articles under it, falling back to
 * same-category articles. Renders nothing if fewer than 2 related items exist.
 * (Explicit series navigation is handled separately by ArticleSeries.)
 */
export default function ArticleTopicCluster({ allArticles, currentSlug, category, tags }: Props) {
  const others = allArticles.filter((a) => a.slug !== currentSlug)

  // Score the candidate cluster tag by how many other articles share it.
  let clusterTag: string | null = null
  let best = 0
  for (const t of tags) {
    const n = others.filter((a) => a.tags?.includes(t)).length
    if (n > best) { best = n; clusterTag = t }
  }

  let heading: string
  let items: ArticleFrontmatter[]
  if (clusterTag && best >= 2) {
    heading = `Связанные темы: #${clusterTag}`
    items = others.filter((a) => a.tags?.includes(clusterTag!)).slice(0, 6)
  } else {
    heading = 'Связанные темы'
    items = others.filter((a) => a.category === category).slice(0, 6)
  }

  if (items.length < 2) return null

  return (
    <section style={{ marginTop: '2.5rem', borderTop: '1px solid #f0ece7', paddingTop: '1.5rem' }}>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem', fontWeight: 800, color: '#1a1a1a' }}>🧭 {heading}</h2>
      <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.map((a) => (
          <li key={a.slug}>
            <Link href={`/${a.category}/${a.slug}/`} style={{ color: '#c0392b', textDecoration: 'none', fontSize: '0.93rem', fontWeight: 600 }}>
              {a.title}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
