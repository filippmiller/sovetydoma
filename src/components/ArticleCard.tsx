import Link from 'next/link'
import type { ArticleFrontmatter } from '@/lib/articles'
import { CATEGORIES } from '@/lib/categories'
import { readingTime, relativeDate, CATEGORY_EMOJI, CATEGORY_COLOR } from '@/lib/utils'
import { resolveArticlePreviewImage } from '@/lib/cloudinary'
import CardFavoriteButton from '@/components/CardFavoriteButton'
import CardShareButton from '@/components/CardShareButton'
import ArticleImage from '@/components/ArticleImage'

interface Props {
  article: ArticleFrontmatter
  wordCount?: number
  featured?: boolean
  viewCount?: number
  ratingAverage?: number | null
  likeCount?: number
}

export default function ArticleCard({ article, wordCount, featured = false, viewCount = 0, ratingAverage = null, likeCount = 0 }: Props) {
  const cat = CATEGORIES[article.category]
  const color = CATEGORY_COLOR[article.category] || '#888'
  const emoji = CATEGORY_EMOJI[article.category] || '📄'
  const time = wordCount ? readingTime('x '.repeat(wordCount)) : '~3 минуты'
  const imageSrc = resolveArticlePreviewImage(article.image, article.slug, { width: 240, height: 240 })
  const cardImageSrc = imageSrc?.startsWith('/images/') ? `${imageSrc}?v=20260531-previews` : imageSrc
  const href = `/${article.category}/${article.slug}`
  const shareUrl = `https://1001sovet.ru/${article.category}/${article.slug}/`
  const shareTitle = article.title

  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
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
        padding: featured ? '1rem' : '0.9rem',
        cursor: 'pointer',
      }}
    >
        <div style={{
          display: 'grid',
          gridTemplateColumns: `minmax(0, 1fr) ${featured ? 'clamp(100px, 28%, 124px)' : 'clamp(88px, 27%, 108px)'}`,
          gap: featured ? '0.95rem' : '0.8rem',
          alignItems: 'start',
          flex: 1,
        }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
              {featured && (
                <span style={{
                  background: `${color}14`, color,
                  fontSize: '0.62rem', fontWeight: 800,
                  padding: '3px 7px', borderRadius: '4px',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Новое
                </span>
              )}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: `${color}12`,
                color,
                borderRadius: '5px',
                padding: '3px 8px',
                fontSize: '0.68rem',
                fontWeight: 750,
                width: 'fit-content',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <span aria-hidden="true">{emoji}</span> {cat?.name || article.categoryName}
              </span>
            </div>

            <h2 style={{
              fontSize: featured ? '1.12rem' : '0.98rem',
              fontWeight: 750,
              lineHeight: 1.35,
              margin: '0 0 0.45rem',
              color: '#1a1a1a',
              overflowWrap: 'anywhere',
            }}>
              {article.title}
            </h2>

            {article.description && (
              <p style={{
                fontSize: '0.85rem',
                color: '#666',
                lineHeight: 1.55,
                flex: 1,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: featured ? 4 : 3,
                WebkitBoxOrient: 'vertical',
                margin: 0,
              }}>
                {article.description}
              </p>
            )}
          </div>

          <div style={{
            position: 'relative',
            aspectRatio: '1 / 1',
            width: '100%',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#f4f0ea',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
          }}>
            <CardFavoriteButton slug={article.slug} />
            <CardShareButton url={shareUrl} title={shareTitle} />
            <div style={{ display: 'block', width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
              {cardImageSrc ? (
                <ArticleImage src={cardImageSrc} alt={article.title} emoji={emoji} fallbackSize={featured ? '2rem' : '1.65rem'} />
              ) : (
                <span aria-hidden="true" style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: featured ? '2rem' : '1.65rem',
                }}>
                  {emoji}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', marginTop: '0.85rem', paddingTop: '0.7rem', borderTop: '1px solid #f0ece7', fontSize: '0.74rem', color: '#999' }}>
          <time style={{ fontSize: '0.74rem', color: '#aaa' }}>
            {relativeDate(article.date)}
          </time>
          <span aria-label="Просмотры" title="Просмотры" style={{ whiteSpace: 'nowrap' }}>
            👁 {viewCount}
          </span>
          <span aria-label="Оценка" title="Оценка" style={{ whiteSpace: 'nowrap' }}>
            ★ {ratingAverage ? ratingAverage.toFixed(1) : '0.0'}
          </span>
          <span aria-label="Нравится" title="Нравится" style={{ whiteSpace: 'nowrap' }}>
            ❤ {likeCount}
          </span>
          <span title="Время чтения" style={{ whiteSpace: 'nowrap', marginLeft: 'auto' }}>
            ⏱ {time}
          </span>
        </div>
      </article>
    </Link>
  )
}
