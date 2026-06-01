import Link from 'next/link'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'
import { resolveArticlePreviewImage } from '@/lib/cloudinary'
import ArticleImage from '@/components/ArticleImage'
import type { ArticleRecommendation } from '@/lib/article-recommendations'

interface Props {
  articles: ArticleRecommendation[]
}

export default function RelatedArticles({ articles }: Props) {
  if (articles.length === 0) return null

  return (
    <section className="related-articles" aria-label="Похожие статьи" style={{ marginTop: '3rem' }}>
      <h2 style={{
        fontSize: '1.2rem',
        fontWeight: 700,
        marginBottom: '1rem',
        color: '#1a1a1a',
        borderTop: '1px solid #e8e4df',
        paddingTop: '2rem',
      }}>
        Похожие статьи
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.9rem' }}>
        {articles.map((article) => {
          const color = CATEGORY_COLOR[article.category] || '#888'
          const emoji = CATEGORY_EMOJI[article.category] || '📄'
          const imageSrc = resolveArticlePreviewImage(article.image, article.slug, { width: 220, height: 160 })
          const cardImageSrc = imageSrc?.startsWith('/images/') ? `${imageSrc}?v=20260531-previews` : imageSrc

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
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 88px',
                gap: '0.8rem',
                minHeight: '128px',
                height: '100%',
                padding: '0.85rem',
                border: `1.5px solid ${color}33`,
              }}>
                <div style={{ minWidth: 0 }}>
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
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4, margin: '0 0 0.3rem' }}>
                    {article.title}
                  </p>
                  {article.description && (
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
                  {article.recommendationReasons.length > 0 && (
                    <p style={{ fontSize: '0.72rem', color: '#999', margin: '0.45rem 0 0' }}>
                      По теме: {article.recommendationReasons.slice(0, 2).join(' · ')}
                    </p>
                  )}
                </div>
                <div style={{
                  position: 'relative',
                  width: '88px',
                  height: '88px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f4f0ea',
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                }}>
                  {cardImageSrc ? (
                    <ArticleImage src={cardImageSrc} alt={article.title} emoji={emoji} fallbackSize="1.5rem" loading="eager" />
                  ) : (
                    <span aria-hidden="true" style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
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
