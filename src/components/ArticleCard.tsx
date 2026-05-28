import Link from 'next/link'
import { ArticleFrontmatter, CATEGORIES } from '@/lib/articles'
import { readingTime, relativeDate, CATEGORY_EMOJI, CATEGORY_COLOR } from '@/lib/utils'

interface Props {
  article: ArticleFrontmatter
  wordCount?: number
}

export default function ArticleCard({ article, wordCount }: Props) {
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
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Gradient hero */}
        <div style={{
          height: '160px',
          background: `linear-gradient(135deg, ${color}dd 0%, ${color}88 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.07,
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          {emoji}
        </div>

        <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Category badge */}
          <span style={{
            display: 'inline-block',
            backgroundColor: color + '18',
            color,
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '0.73rem',
            fontWeight: 700,
            marginBottom: '0.6rem',
            width: 'fit-content',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {cat?.name || article.categoryName}
          </span>

          <h2 style={{
            fontSize: '1rem',
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: '0.5rem',
            color: '#1a1a1a',
          }}>
            {article.title}
          </h2>

          <p style={{
            fontSize: '0.87rem',
            color: '#666',
            lineHeight: 1.6,
            flex: 1,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}>
            {article.description}
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
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
