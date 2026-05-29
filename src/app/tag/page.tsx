import { getAllTags } from '@/lib/articles'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Все теги — СоветыДома',
  description: 'Полный список тем и тегов на СоветыДома — выберите интересующую вас тему',
}

export default function TagIndexPage() {
  const tags = getAllTags()
  if (tags.length === 0) return null

  const maxCount = tags[0].count  // already sorted desc
  const minCount = tags[tags.length - 1].count

  // Map count → font size between 0.85rem and 2.1rem
  function fontSize(count: number): string {
    if (maxCount === minCount) return '1.2rem'
    const ratio = (count - minCount) / (maxCount - minCount)
    const size = 0.85 + ratio * (2.1 - 0.85)
    return `${size.toFixed(2)}rem`
  }

  // Map count → color: gray (#999) for rare, #c0392b for popular
  function tagColor(count: number): string {
    if (maxCount === minCount) return '#888'
    const ratio = (count - minCount) / (maxCount - minCount)
    // Interpolate gray(153,153,153) → red(192,57,43)
    const r = Math.round(153 + ratio * (192 - 153))
    const g = Math.round(153 + ratio * (57 - 153))
    const b = Math.round(153 + ratio * (43 - 153))
    return `rgb(${r},${g},${b})`
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.4rem' }}>
          Все теги
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>
          {tags.length} тем — размер слова соответствует количеству статей
        </p>
      </header>

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.6rem 0.8rem',
        alignItems: 'baseline',
        lineHeight: 1.6,
        padding: '1.5rem',
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e8e4df',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        {tags.map(({ tag, count }) => (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            title={`${count} ${count === 1 ? 'статья' : count < 5 ? 'статьи' : 'статей'}`}
            style={{
              fontSize: fontSize(count),
              color: tagColor(count),
              fontWeight: count >= maxCount * 0.6 ? 700 : 500,
              textDecoration: 'none',
              transition: 'opacity 0.15s',
              display: 'inline-block',
            }}
            className="tag-cloud-link"
          >
            #{tag}
            <sup style={{ fontSize: '0.6em', marginLeft: '2px', opacity: 0.55 }}>{count}</sup>
          </Link>
        ))}
      </div>

      <p style={{ marginTop: '1.5rem', fontSize: '0.82rem', color: '#bbb', textAlign: 'center' }}>
        Нажмите на тег, чтобы увидеть все статьи по этой теме
      </p>
    </div>
  )
}
