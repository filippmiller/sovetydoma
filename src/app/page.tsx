import { getAllArticles, CATEGORIES } from '@/lib/articles'
import ArticleCard from '@/components/ArticleCard'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'СоветыДома — полезные советы для дома, кухни и дачи',
  description:
    'Лайфхаки, рецепты, советы по уборке, огороду и экономии. Практичные идеи для жизни в России.',
  openGraph: {
    title: 'СоветыДома — полезные советы для дома, кухни и дачи',
    description: 'Лайфхаки, рецепты, советы по уборке, огороду и экономии.',
    type: 'website',
  },
}

export default function HomePage() {
  const articles = getAllArticles()

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Hero */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.5rem' }}>
          Полезные советы на каждый день
        </h1>
        <p style={{ color: '#666', fontSize: '1rem' }}>
          Рецепты, лайфхаки, дача и экономия — всё проверено на практике
        </p>
      </section>

      {/* Category quick links */}
      <section style={{ marginBottom: '2.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {Object.values(CATEGORIES).map((cat) => (
          <Link
            key={cat.slug}
            href={`/${cat.slug}`}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '999px',
              border: '1.5px solid #e0dbd5',
              fontSize: '0.88rem',
              color: '#444',
              textDecoration: 'none',
              backgroundColor: '#fff',
              fontWeight: 500,
            }}
          >
            {cat.name}
          </Link>
        ))}
      </section>

      {/* Articles grid */}
      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', color: '#1a1a1a' }}>
          Свежие статьи
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}>
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </section>
    </div>
  )
}
