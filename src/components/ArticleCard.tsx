import Link from 'next/link'
import { ArticleFrontmatter, CATEGORIES } from '@/lib/articles'

interface Props {
  article: ArticleFrontmatter
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CATEGORY_COLORS: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
}

export default function ArticleCard({ article }: Props) {
  const cat = CATEGORIES[article.category]
  const color = CATEGORY_COLORS[article.category] || '#888'

  return (
    <Link
      href={`/${article.category}/${article.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column' }}
    >
      <article
        style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'box-shadow 0.2s, transform 0.2s',
        }}
        className="article-card"
      >
        {/* Image placeholder */}
        <div style={{
          backgroundColor: color,
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          <span style={{ fontSize: '3rem' }}>
            {article.category === 'kulinaria' ? '🍲' :
             article.category === 'dom-i-uborka' ? '🧹' :
             article.category === 'dacha-i-ogorod' ? '🌱' :
             article.category === 'layfkhaki' ? '💡' : '💰'}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Category badge */}
          <span style={{
            display: 'inline-block',
            backgroundColor: color + '18',
            color: color,
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginBottom: '0.6rem',
            width: 'fit-content',
          }}>
            {cat?.name || article.categoryName}
          </span>

          <h2 style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: '0.5rem',
            color: '#1a1a1a',
          }}>
            {article.title}
          </h2>

          <p style={{
            fontSize: '0.88rem',
            color: '#666',
            lineHeight: 1.6,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {article.description}
          </p>

          <time style={{ fontSize: '0.78rem', color: '#999', marginTop: '0.75rem', display: 'block' }}>
            {formatDate(article.date)}
          </time>
        </div>
      </article>

      <style>{`
        .article-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.13) !important;
          transform: translateY(-2px);
        }
      `}</style>
    </Link>
  )
}
