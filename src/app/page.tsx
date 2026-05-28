import { getAllArticles, CATEGORIES } from '@/lib/articles'
import ArticleCard from '@/components/ArticleCard'
import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pogovorim.vsedomatut.com'

export const metadata: Metadata = {
  title: 'СоветыДома — полезные советы для дома, кухни и дачи',
  description: 'Лайфхаки, рецепты, советы по уборке, огороду и экономии. Практичные идеи для жизни в России.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'СоветыДома — полезные советы для дома, кухни и дачи',
    description: 'Лайфхаки, рецепты, советы по уборке, огороду и экономии.',
    type: 'website',
    url: SITE_URL,
  },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'СоветыДома',
  url: SITE_URL,
  description: 'Полезные советы и лайфхаки для дома, кухни, дачи и экономии',
  inLanguage: 'ru-RU',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
}

export default function HomePage() {
  const articles = getAllArticles()
  const featured = articles.slice(0, 3)
  const rest = articles.slice(3)
  const catCounts = Object.fromEntries(
    Object.keys(CATEGORIES).map((cat) => [cat, articles.filter((a) => a.category === cat).length])
  )

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>

        {/* Hero */}
        <section style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.4rem' }}>
            Полезные советы на каждый день
          </h1>
          <p style={{ color: '#777', fontSize: '1rem', margin: 0 }}>
            Рецепты, лайфхаки, дача и экономия — всё проверено на практике
          </p>
        </section>

        {/* Category chips with counts */}
        <section style={{ marginBottom: '2.5rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {Object.values(CATEGORIES).map((cat) => {
            const color = CATEGORY_COLOR[cat.slug]
            return (
              <Link key={cat.slug} href={`/${cat.slug}`} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.45rem 1rem', borderRadius: '999px',
                border: `1.5px solid ${color}44`, fontSize: '0.85rem',
                color: color, textDecoration: 'none', backgroundColor: color + '0d',
                fontWeight: 600,
              }}>
                {cat.name}
                <span style={{ background: color + '22', borderRadius: '999px', padding: '1px 6px', fontSize: '0.72rem' }}>
                  {catCounts[cat.slug]}
                </span>
              </Link>
            )
          })}
        </section>

        {/* Featured row */}
        {featured.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🔥 Популярное
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {featured.map((article) => (
                <ArticleCard key={article.slug} article={article} wordCount={article.wordCount} />
              ))}
            </div>
          </section>
        )}

        {/* Rest of articles */}
        {rest.length > 0 && (
          <section>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Свежие статьи
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {rest.map((article) => (
                <ArticleCard key={article.slug} article={article} wordCount={article.wordCount} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  )
}
