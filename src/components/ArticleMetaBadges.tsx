import type { ArticleFrontmatter } from '@/lib/articles'

interface Props {
  fm: ArticleFrontmatter
}

const DIFFICULTY_STARS: Record<string, number> = {
  'Легко': 1,
  'Средне': 3,
  'Сложно': 5,
}

/**
 * Compact effort badges rendered near the article title.
 * Only visible when the corresponding frontmatter value is present.
 */
export default function ArticleMetaBadges({ fm }: Props) {
  const badges: React.ReactNode[] = []

  if (fm.difficulty && DIFFICULTY_STARS[fm.difficulty]) {
    const stars = DIFFICULTY_STARS[fm.difficulty]
    badges.push(
      <span key="difficulty" aria-label={`Сложность ${fm.difficulty}`} style={badgeStyle}>
        <span style={{ color: '#f39c12' }}>{'★'.repeat(stars)}</span>
        <span style={{ color: '#c1b8ad' }}>{'☆'.repeat(5 - stars)}</span>
      </span>,
    )
  }

  if (fm.time?.trim()) {
    badges.push(
      <span key="time" style={badgeStyle}>
        ⏱ {fm.time}
      </span>,
    )
  }

  if (fm.cost?.trim()) {
    badges.push(
      <span key="cost" style={badgeStyle}>
        💰 {fm.cost}
      </span>,
    )
  }

  if (badges.length === 0) return null

  return (
    <div className="article-meta-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.6rem' }}>
      {badges}
    </div>
  )
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.2rem',
  fontSize: '0.78rem',
  fontWeight: 700,
  color: '#555',
  background: '#f5f2ed',
  border: '1px solid #e9e3db',
  borderRadius: '999px',
  padding: '0.2rem 0.65rem',
}
