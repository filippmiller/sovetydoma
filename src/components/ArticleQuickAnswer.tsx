import type { ArticleFrontmatter } from '@/lib/articles'

interface Props {
  fm: ArticleFrontmatter
}

const DIFFICULTY_STARS: Record<string, number> = {
  'Легко': 1,
  'Средне': 3,
  'Сложно': 5,
}

function firstSentences(text: string, max = 2): string {
  if (!text) return ''
  const parts = text.split(/(?<=[.!?])\s+/).slice(0, max)
  return parts.join(' ')
}

/**
 * "Краткий ответ" block shown near the top of an article.
 * Data-driven with safe fallbacks:
 *  - answer: fm.quickAnswer, else first 2 sentences of the description
 *  - time:   fm.time, else derived nothing (hidden)
 *  - difficulty: fm.difficulty → stars
 *  - needs:  fm.needs, else fm.recipeIngredient
 *  - forWhom: fm.forWhom (hidden if absent)
 * Renders nothing if there is no answer text at all.
 */
export default function ArticleQuickAnswer({ fm }: Props) {
  const answer = (fm.quickAnswer && fm.quickAnswer.trim()) || firstSentences(fm.description || '')
  if (!answer) return null

  const stars = fm.difficulty ? DIFFICULTY_STARS[fm.difficulty] : undefined
  const needs = (fm.needs && fm.needs.length ? fm.needs : fm.recipeIngredient) || []
  const time = fm.time

  return (
    <aside
      aria-label="Краткий ответ"
      style={{
        background: '#fbf7f2',
        border: '1px solid #ece3d8',
        borderLeft: '4px solid #c0392b',
        borderRadius: '10px',
        padding: '1.1rem 1.25rem',
        margin: '0 0 1.75rem',
      }}
    >
      <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '0.5rem' }}>
        ⚡ Краткий ответ
      </div>
      <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, color: '#2a2a2a' }}>{answer}</p>

      {(time || stars || needs.length > 0 || fm.forWhom) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
          {time && (
            <div>
              <div style={metaLabel}>⏱ Время</div>
              <div style={metaValue}>{time}</div>
            </div>
          )}
          {stars && (
            <div>
              <div style={metaLabel}>📊 Сложность</div>
              <div style={metaValue} aria-label={`Сложность ${fm.difficulty}`}>
                <span style={{ color: '#f39c12' }}>{'★'.repeat(stars)}</span>
                <span style={{ color: '#ddd' }}>{'☆'.repeat(5 - stars)}</span>
              </div>
            </div>
          )}
          {needs.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={metaLabel}>🧰 Что понадобится</div>
              <div style={metaValue}>{needs.join(', ')}</div>
            </div>
          )}
          {fm.forWhom && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={metaLabel}>👤 Для кого подходит</div>
              <div style={metaValue}>{fm.forWhom}</div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

const metaLabel: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem',
}
const metaValue: React.CSSProperties = {
  fontSize: '0.92rem', color: '#2a2a2a', lineHeight: 1.45,
}
