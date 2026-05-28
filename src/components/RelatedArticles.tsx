import Link from 'next/link'
import { ArticleFrontmatter } from '@/lib/articles'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'

interface Props {
  articles: ArticleFrontmatter[]
  currentSlug: string
}

export default function RelatedArticles({ articles, currentSlug }: Props) {
  const related = articles.filter((a) => a.slug !== currentSlug).slice(0, 3)
  if (related.length === 0) return null

  return (
    <section className="related-articles" style={{ marginTop: '3rem' }}>
      <h2 style={{
        fontSize: '1.2rem',
        fontWeight: 700,
        marginBottom: '1rem',
        color: '#1a1a1a',
        borderTop: '1px solid #e8e4df',
        paddingTop: '2rem',
      }}>
        Читайте также
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {related.map((article) => {
          const color = CATEGORY_COLOR[article.category] || '#888'
          const emoji = CATEGORY_EMOJI[article.category] || '📄'
          return (
            <Link
              key={article.slug}
              href={`/${article.category}/${article.slug}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="article-card" style={{
                background: '#fff',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                display: 'flex',
                flexDirection: 'column',
              }}>
                <div style={{
                  height: '80px',
                  background: `linear-gradient(135deg, ${color}cc 0%, ${color}66 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                }}>
                  {emoji}
                </div>
                <div style={{ padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4, margin: 0 }}>
                    {article.title}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
