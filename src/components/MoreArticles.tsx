import Link from 'next/link'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'
import { resolveArticlePreviewImage } from '@/lib/cloudinary'
import ArticleImage from '@/components/ArticleImage'
import type { ArticleRecommendation } from '@/lib/article-recommendations'

interface Props {
  articles: ArticleRecommendation[]
}

export default function MoreArticles({ articles }: Props) {
  if (articles.length === 0) return null

  return (
    <section aria-label="Может пригодиться" style={{ marginTop: '3rem' }}>
      <h2 style={{
        fontSize: '1.2rem',
        fontWeight: 700,
        marginBottom: '1rem',
        color: '#1a1a1a',
        borderTop: '1px solid #e8e4df',
        paddingTop: '2rem',
      }}>
        Может пригодиться
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '0.9rem',
      }}>
        {articles.map((article) => {
          const color = CATEGORY_COLOR[article.category] || '#888'
          const emoji = CATEGORY_EMOJI[article.category] || '📄'
          const imageSrc = resolveArticlePreviewImage(article.image, article.slug, { width: 220, height: 160 })
          const cardImageSrc = imageSrc?.startsWith('/images/') ? `${imageSrc}?v=20260531-previews` : imageSrc

          return (
            <Link
              key={`${article.category}-${article.slug}`}
              href={`/${article.category}/${article.slug}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <article className="article-card" style={{
                background: 'var(--warm-card, #fff)',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 76px',
                gap: '0.75rem',
                height: '100%',
                minHeight: '112px',
                padding: '0.8rem',
                border: '1px solid #f0ece7',
              }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'inline-flex',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: '0.35rem',
                    background: `${color}12`,
                    borderRadius: '5px',
                    padding: '3px 8px',
                  }}>
                    {article.categoryName}
                  </span>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #1a1a1a)', lineHeight: 1.4, margin: '0 0 0.35rem' }}>
                    {article.title}
                  </p>
                  {article.description && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: '#666',
                      lineHeight: 1.4,
                      margin: 0,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {article.description}
                    </p>
                  )}
                </div>
                <div style={{
                  position: 'relative',
                  width: '76px',
                  height: '76px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#f4f0ea',
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                }}>
                  {cardImageSrc ? (
                    <ArticleImage src={cardImageSrc} alt={article.title} emoji={emoji} fallbackSize="1.35rem" loading="eager" />
                  ) : (
                    <span aria-hidden="true" style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.35rem',
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
