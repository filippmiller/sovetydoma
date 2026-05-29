import Link from 'next/link'
import { ArticleFrontmatter } from '@/lib/articles'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'

interface Props {
  articles: ArticleFrontmatter[]
}

export default function MoreArticles({ articles }: Props) {
  if (articles.length === 0) return null

  return (
    <section aria-label="Другие советы" style={{ marginTop: '3rem' }}>
      <h2 style={{
        fontSize: '1.2rem',
        fontWeight: 700,
        marginBottom: '1rem',
        color: '#1a1a1a',
        borderTop: '1px solid #e8e4df',
        paddingTop: '2rem',
      }}>
        Другие советы
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem',
      }}>
        {articles.map((article) => {
          const color = CATEGORY_COLOR[article.category] || '#888'
          const emoji = CATEGORY_EMOJI[article.category] || '📄'
          return (
            <Link
              key={`${article.category}-${article.slug}`}
              href={`/${article.category}/${article.slug}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="article-card" style={{
                background: 'var(--warm-card, #fff)',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
              }}>
                <div style={{
                  height: '72px',
                  background: `linear-gradient(135deg, ${color}cc 0%, ${color}66 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                  flexShrink: 0,
                }}>
                  {emoji}
                </div>
                <div style={{ padding: '0.75rem', flex: 1 }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '0.35rem',
                  }}>
                    {article.categoryName}
                  </span>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #1a1a1a)', lineHeight: 1.4, margin: 0 }}>
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
