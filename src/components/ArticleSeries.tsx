import Link from 'next/link'

interface SeriesArticle {
  slug: string
  title: string
  seriesName?: string
  seriesOrder?: number
  category: string
}

interface ArticleSeriesProps {
  seriesName: string
  currentSlug: string
  allArticles: SeriesArticle[]
}

export default function ArticleSeries({ seriesName, currentSlug, allArticles }: ArticleSeriesProps) {
  const seriesArticles = allArticles
    .filter((a) => a.seriesName === seriesName)
    .sort((a, b) => (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999))

  if (seriesArticles.length < 2) return null

  const currentIndex = seriesArticles.findIndex((a) => a.slug === currentSlug)
  const prev = currentIndex > 0 ? seriesArticles[currentIndex - 1] : null
  const next = currentIndex < seriesArticles.length - 1 ? seriesArticles[currentIndex + 1] : null

  return (
    <div style={{
      backgroundColor: '#fff',
      border: '1px solid #e8e4df',
      borderRadius: '8px',
      padding: '1.25rem',
      marginBottom: '1.5rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.9rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid #f0ede8',
      }}>
        <span style={{ fontSize: '1.1rem' }}>📚</span>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#444' }}>
          Серия: <span style={{ color: '#c0392b' }}>{seriesName}</span>
        </span>
      </div>

      {/* Article list */}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {seriesArticles.map((article, i) => {
          const isCurrent = article.slug === currentSlug
          return (
            <li key={article.slug} style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.5rem',
              padding: '0.4rem 0.5rem',
              borderRadius: '5px',
              backgroundColor: isCurrent ? '#fdf5f5' : 'transparent',
            }}>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#888',
                minWidth: '60px',
              }}>
                Часть {i + 1}:
              </span>
              {isCurrent ? (
                <span style={{
                  fontWeight: 700,
                  color: '#c0392b',
                  fontSize: '0.92rem',
                  flex: 1,
                }}>
                  {article.title}
                  <span style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.78rem',
                    fontWeight: 400,
                    color: '#c0392b',
                    opacity: 0.75,
                  }}>
                    ← вы здесь
                  </span>
                </span>
              ) : (
                <Link
                  href={`/${article.category}/${article.slug}/`}
                  style={{
                    color: '#333',
                    fontSize: '0.92rem',
                    textDecoration: 'none',
                    flex: 1,
                  }}
                >
                  {article.title}
                </Link>
              )}
            </li>
          )
        })}
      </ol>

      {/* Prev / Next navigation */}
      {(prev || next) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f0ede8',
        }}>
          <div style={{ flex: 1 }}>
            {prev && (
              <Link
                href={`/${prev.category}/${prev.slug}/`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: '#c0392b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                ← Предыдущая
              </Link>
            )}
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            {next && (
              <Link
                href={`/${next.category}/${next.slug}/`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: '#c0392b',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Следующая →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
