import { getAllArticles, CATEGORIES } from '@/lib/articles'
import ArticleCard from '@/components/ArticleCard'
import SeasonalBanner from '@/components/SeasonalBanner'
import PopularArticles from '@/components/PopularArticles'
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

  const popularArticleData = articles.map((a) => ({
    title: a.title,
    slug: a.slug,
    category: a.category,
    categoryName: a.categoryName,
    date: a.date,
  }))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>

        {/* Hero */}
        <section style={{
          marginBottom: '2.5rem',
          background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.75, margin: '0 0 0.5rem' }}>
              Практичные советы для дома
            </p>
            <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, lineHeight: 1.2, margin: '0 0 0.75rem' }}>
              Полезные советы<br />на каждый день
            </h1>
            <p style={{ fontSize: '1.05rem', opacity: 0.88, margin: '0 0 1.5rem', maxWidth: '520px', lineHeight: 1.6 }}>
              Рецепты, лайфхаки, дача и экономия — всё проверено на практике. {articles.length} статей по {Object.keys(CATEGORIES).length} темам.
            </p>
            <Link href="/kulinaria" style={{
              display: 'inline-block',
              backgroundColor: '#fff',
              color: '#c0392b',
              fontWeight: 700,
              fontSize: '0.95rem',
              padding: '0.65rem 1.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}>
              Читать советы →
            </Link>
          </div>
        </section>

        {/* Category chips */}
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.9rem' }}>
            Разделы
          </h2>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {Object.values(CATEGORIES).map((cat) => {
              const color = CATEGORY_COLOR[cat.slug]
              return (
                <Link key={cat.slug} href={`/${cat.slug}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.5rem 1.1rem', borderRadius: '999px',
                  border: `2px solid ${color}55`, fontSize: '0.88rem',
                  color: color, textDecoration: 'none', backgroundColor: color + '12',
                  fontWeight: 700, minHeight: '44px',
                }}>
                  {cat.name}
                  <span style={{
                    background: color, color: '#fff', borderRadius: '999px',
                    padding: '1px 7px', fontSize: '0.72rem', fontWeight: 800,
                  }}>
                    {catCounts[cat.slug]}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* F15: Seasonal content banner */}
        <SeasonalBanner />

        {/* Featured row */}
        {featured.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔥</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
                Последние советы
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#aaa', marginLeft: '0.3rem' }}>— самое свежее</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {featured.map((article, i) => (
                <ArticleCard key={article.slug} article={article} wordCount={article.wordCount} featured={i === 0} />
              ))}
            </div>
          </section>
        )}

        {/* Rest of articles */}
        {rest.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
                Ещё статьи
              </h2>
              <Link href="/kulinaria" style={{ fontSize: '0.85rem', color: '#c0392b', textDecoration: 'none', fontWeight: 600 }}>
                Все разделы →
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {rest.map((article) => (
                <ArticleCard key={article.slug} article={article} wordCount={article.wordCount} />
              ))}
            </div>
          </section>
        )}

        {/* F7: Popular articles (localStorage view tracking) */}
        <PopularArticles articles={popularArticleData} />

        {/* RSS link */}
        <div style={{ marginTop: '2.5rem', padding: '1rem 1.25rem', background: '#fff', borderRadius: '8px', border: '1px solid #e8e4df', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.1rem' }}>📡</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '0.88rem', color: '#555', fontWeight: 600 }}>RSS-лента</span>
            <span style={{ fontSize: '0.83rem', color: '#999', marginLeft: '0.5rem' }}>Подписывайтесь, чтобы не пропускать новые статьи</span>
          </div>
          <Link href="/feed.xml" style={{
            fontSize: '0.83rem', color: '#c0392b', textDecoration: 'none',
            fontWeight: 700, border: '1.5px solid #c0392b33',
            padding: '0.35rem 0.85rem', borderRadius: '6px', backgroundColor: '#c0392b0a',
          }}>
            RSS ↗
          </Link>
        </div>

      </div>
    </>
  )
}
