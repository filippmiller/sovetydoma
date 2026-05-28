import Link from 'next/link'
import { getAllArticles, getAllTags, CATEGORIES } from '@/lib/articles'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Поиск по сайту',
  description: 'Найдите нужную статью на СоветыДома — поиск по рубрикам и тегам',
  robots: { index: false },
}

export default function SearchPage() {
  const articles = getAllArticles()
  const tags = getAllTags().slice(0, 20)

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1a1a1a' }}>Поиск</h1>
      <p style={{ color: '#888', marginBottom: '2rem' }}>
        Полнотекстовый поиск появится скоро. Пока можно выбрать раздел или тег.
      </p>

      {/* Browse by category */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#444' }}>По разделу</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
          {Object.values(CATEGORIES).map((cat) => {
            const count = articles.filter((a) => a.category === cat.slug).length
            return (
              <Link key={cat.slug} href={`/${cat.slug}`} style={{
                padding: '0.5rem 1rem', borderRadius: '8px', border: '1.5px solid #e0dbd5',
                textDecoration: 'none', color: '#444', fontSize: '0.9rem', fontWeight: 500,
                backgroundColor: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}>
                {cat.name} <span style={{ color: '#aaa', fontSize: '0.8rem' }}>({count})</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Browse by tag */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#444' }}>По тегу</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {tags.map(({ tag, count }) => (
            <Link key={tag} href={`/tag/${encodeURIComponent(tag)}`} style={{
              padding: '4px 12px', borderRadius: '4px',
              backgroundColor: '#f0ede8', color: '#555',
              textDecoration: 'none', fontSize: '0.85rem',
            }}>
              #{tag} <span style={{ color: '#aaa' }}>({count})</span>
            </Link>
          ))}
        </div>
      </section>

      {/* All articles list */}
      <section>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#444' }}>Все статьи</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {articles.map((a) => (
            <li key={a.slug} style={{ borderBottom: '1px solid #f0ede8', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
              <Link href={`/${a.category}/${a.slug}`} style={{ textDecoration: 'none', color: '#1a1a1a', fontWeight: 600, fontSize: '0.95rem' }}>
                {a.title}
              </Link>
              <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.2rem' }}>
                {CATEGORIES[a.category]?.name} · {a.date}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
