import Link from 'next/link'
import { ArticleFrontmatter } from '@/lib/articles'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'

interface Props {
  articles: (ArticleFrontmatter & { wordCount?: number })[]
  currentSlug: string
  currentTags?: string[]
}

function tagSimilarity(tagsA: string[], tagsB: string[]): number {
  const setA = new Set(tagsA)
  return tagsB.filter((t) => setA.has(t)).length
}

export default function RelatedArticles({ articles, currentSlug, currentTags = [] }: Props) {
  const candidates = articles.filter((a) => a.slug !== currentSlug)

  // F9: score by shared tags, then by date as tiebreaker
  const scored = candidates.map((a) => ({
    ...a,
    score: tagSimilarity(currentTags, a.tags),
  }))
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.date < b.date ? 1 : -1
  })

  const related = scored.slice(0, 3)
  if (related.length === 0) return null

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
                border: article.score > 0 ? `1.5px solid ${color}44` : '1px solid #f0ece7',
              }}>
                <div style={{
                  height: '80px',
                  background: `linear-gradient(135deg, ${color}cc 0%, ${color}66 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  position: 'relative',
                }}>
                  {emoji}
                  {article.score > 0 && (
                    <span style={{
                      position: 'absolute', top: '6px', right: '6px',
                      fontSize: '0.6rem', fontWeight: 700,
                      backgroundColor: color, color: '#fff',
                      borderRadius: '3px', padding: '1px 5px',
                      textTransform: 'uppercase',
                    }}>
                      {article.score} {article.score === 1 ? 'тег' : article.score < 5 ? 'тега' : 'тегов'}
                    </span>
                  )}
                </div>
                <div style={{ padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4, margin: '0 0 0.3rem' }}>
                    {article.title}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#aaa', margin: 0 }}>
                    {article.categoryName}
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
