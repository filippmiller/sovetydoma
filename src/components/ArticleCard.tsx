import Link from 'next/link'
import { ArticleFrontmatter, CATEGORIES } from '@/lib/articles'
import { readingTime, relativeDate, CATEGORY_EMOJI, CATEGORY_COLOR } from '@/lib/utils'
import CardFavoriteButton from '@/components/CardFavoriteButton'

interface Props {
  article: ArticleFrontmatter
  wordCount?: number
  featured?: boolean
}

export default function ArticleCard({ article, wordCount, featured = false }: Props) {
  const cat = CATEGORIES[article.category]
  const color = CATEGORY_COLOR[article.category] || '#888'
  const emoji = CATEGORY_EMOJI[article.category] || '📄'
  const time = wordCount ? readingTime('x '.repeat(wordCount)) : '~3 минуты'

  return (
    <Link
      href={`/${article.category}/${article.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
    >
      <article
        className="article-card"
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: featured ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.08)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: featured ? `2px solid ${color}44` : '1px solid #f0ece7',
        }}
      >
        {/* Gradient hero */}
        <div style={{
          height: featured ? '200px' : '160px',
          background: `linear-gradient(135deg, ${color}dd 0%, ${color}88 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: featured ? '4.5rem' : '3.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.07,
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {featured && (
            <span style={{
              position: 'absolute', top: '0.75rem', left: '0.75rem',
              background: '#fff', color: color,
              fontSize: '0.65rem', fontWeight: 800,
              padding: '3px 8px', borderRadius: '4px',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              Новое
            </span>
          )}
          <CardFavoriteButton slug={article.slug} />
          <span aria-hidden="true">{emoji}</span>
        </div>

        <div style={{ padding: featured ? '1.25rem' : '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Category badge */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: color,
            color: '#fff',
            borderRadius: '5px',
            padding: '3px 9px',
            fontSize: '0.7rem',
            fontWeight: 700,
            marginBottom: '0.65rem',
            width: 'fit-content',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <span aria-hidden="true">{emoji}</span> {cat?.name || article.categoryName}
          </span>

          <h2 style={{
            fontSize: featured ? '1.15rem' : '1rem',
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: '0.5rem',
            color: '#1a1a1a',
          }}>
            {article.title}
          </h2>

          {article.description && (
            <p style={{
              fontSize: '0.87rem',
              color: '#666',
              lineHeight: 1.65,
              flex: 1,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              margin: 0,
            }}>
              {article.description}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #f0ece7' }}>
            <time style={{ fontSize: '0.76rem', color: '#bbb' }}>
              {relativeDate(article.date)}
            </time>
            <span style={{ fontSize: '0.76rem', color: '#bbb' }}>
              ⏱ {time}
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
