import Link from 'next/link'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'
import { resolveArticlePreviewImage } from '@/lib/cloudinary'
import ArticleImage from '@/components/ArticleImage'
import type { ArticleRecommendation } from '@/lib/article-recommendations'

interface Props {
  articles: ArticleRecommendation[]
  compact?: boolean
}

export default function RelatedArticles({ articles, compact = false }: Props) {
  if (articles.length === 0) return null

  return (
    <section
      className="related-articles"
      aria-label="Читайте также"
      style={{
        marginTop: compact ? '1rem' : '3rem',
        borderTop: compact ? '0' : '1px solid #e8e4df',
        paddingTop: compact ? '0' : '2rem',
      }}
    >
      <h2 style={{
        fontSize: compact ? '0.9rem' : '1.2rem',
        fontWeight: 800,
        marginBottom: compact ? '0.65rem' : '1rem',
        color: compact ? '#555' : '#1a1a1a',
        textTransform: compact ? 'uppercase' : 'none',
        letterSpacing: compact ? '0.05em' : 0,
      }}>
        Читайте также
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: compact ? '0.65rem' : '0.9rem',
      }}>
        {articles.map((article) => {
          const color = CATEGORY_COLOR[article.category] || '#888'
          const emoji = CATEGORY_EMOJI[article.category] || '📄'
          const imageSrc = resolveArticlePreviewImage(article.image, article.slug, { width: 220, height: 160 })
          const cardImageSrc = imageSrc?.startsWith('/images/') ? `${imageSrc}?v=20260531-previews` : imageSrc
          const imageSize = compact ? 62 : 88

          return (
            <Link
              key={article.slug}
              href={`/${article.category}/${article.slug}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <article className="article-card" style={{
                background: '#fff',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: compact ? '0 1px 3px rgba(0,0,0,0.05)' : '0 1px 4px rgba(0,0,0,0.07)',
                display: 'grid',
                gridTemplateColumns: `minmax(0, 1fr) ${imageSize}px`,
                gap: compact ? '0.6rem' : '0.8rem',
                minHeight: compact ? '82px' : '128px',
                height: '100%',
                padding: compact ? '0.65rem' : '0.85rem',
                border: `1px solid ${color}33`,
              }}>
                <div style={{ minWidth: 0 }}>
                  {!compact && (
                    <span style={{
                      display: 'inline-flex',
                      width: 'fit-content',
                      maxWidth: '100%',
                      marginBottom: '0.45rem',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      background: `${color}12`,
                      color,
                      fontSize: '0.68rem',
                      fontWeight: 750,
                      textTransform: 'uppercase',
                    }}>
                      {article.categoryName}
                    </span>
                  )}
                  <p style={{
                    fontSize: compact ? '0.78rem' : '0.88rem',
                    fontWeight: 700,
                    color: '#1a1a1a',
                    lineHeight: 1.35,
                    margin: '0 0 0.25rem',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: compact ? 3 : 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {article.title}
                  </p>
                  {!compact && article.description && (
                    <p style={{
                      fontSize: '0.76rem',
                      color: '#666',
                      lineHeight: 1.45,
                      margin: 0,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {article.description}
                    </p>
                  )}
                  {!compact && article.recommendationReasons.length > 0 && (
                    <p style={{ fontSize: '0.72rem', color: '#999', margin: '0.45rem 0 0' }}>
                      По теме: {article.recommendationReasons.slice(0, 2).join(' · ')}
                    </p>
                  )}
                </div>
                <div style={{
                  position: 'relative',
                  width: `${imageSize}px`,
                  height: `${imageSize}px`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f4f0ea',
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                }}>
                  {cardImageSrc ? (
                    <ArticleImage src={cardImageSrc} alt={article.title} emoji={emoji} fallbackSize={compact ? '1.1rem' : '1.5rem'} loading="lazy" />
                  ) : (
                    <span aria-hidden="true" style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: compact ? '1.1rem' : '1.5rem',
                    }}>
                      {emoji}
                    </span>
                  )}
                </div>
              </article>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
