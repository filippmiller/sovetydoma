import { getAllArticles, CATEGORIES } from '@/lib/articles'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'
import SeasonalBanner from '@/components/SeasonalBanner'
import PopularArticles from '@/components/PopularArticles'
import PersonalisedSection from '@/components/PersonalisedSection'
import StartHereSection from '@/components/StartHereSection'
import HeroSearchControls from '@/components/HeroSearchControls'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_NAME, SITE_URL, canonicalPath, absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'СоветыДома — полезные советы для дома, кухни и дачи',
  description: 'Лайфхаки, рецепты, советы по уборке, огороду и экономии. Практичные идеи для жизни в России.',
  alternates: { canonical: canonicalPath('/') },
  openGraph: {
    title: 'СоветыДома — полезные советы для дома, кухни и дачи',
    description: 'Лайфхаки, рецепты, советы по уборке, огороду и экономии.',
    type: 'website',
    url: canonicalPath('/'),
  },
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: canonicalPath('/'),
  description: 'Полезные советы и лайфхаки для дома, кухни, дачи и экономии',
  inLanguage: 'ru-RU',
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: canonicalPath('/'),
  logo: absoluteUrl('/icon-512.png'),
}

const CATEGORY_COLOR: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
  rybalka: '#2c7da0',
}

export default function HomePage() {
  const articles = getAllArticles()
  const catCounts = Object.fromEntries(
    Object.keys(CATEGORIES).map((cat) => [cat, articles.filter((a) => a.category === cat).length])
  )
  const categoryOptions = Object.values(CATEGORIES).map((cat) => ({
    slug: cat.slug,
    name: cat.name,
    count: catCounts[cat.slug] || 0,
  }))

  const popularArticleData = articles.map((a) => ({
    title: a.title,
    slug: a.slug,
    category: a.category,
    categoryName: a.categoryName,
    date: a.date,
  }))

  const articlesForClient = articles.map((a) => ({
    slug: a.slug,
    title: a.title,
    category: a.category,
    categoryName: a.categoryName,
    date: a.date,
    description: a.description,
    tags: a.tags,
  }))

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem 1rem 2rem' }}>

        {/* Hero */}
        <section style={{
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #c0392b 0%, #922b21 100%)',
          borderRadius: '10px',
          padding: '0.8rem 1.15rem',
          color: '#fff',
          position: 'relative',
          overflow: 'visible',
          zIndex: 20,
          minHeight: '94px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '240px', flex: '1 1 320px' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.72, margin: '0 0 0.22rem' }}>
              Практичные советы для дома
            </p>
            <h1 style={{ fontSize: 'clamp(1.15rem, 2.7vw, 1.65rem)', fontWeight: 800, lineHeight: 1.18, margin: '0 0 0.25rem' }}>
              Полезные советы на каждый день
            </h1>
            <p style={{ fontSize: '0.88rem', opacity: 0.86, margin: 0, maxWidth: '620px', lineHeight: 1.4 }}>
              Рецепты, лайфхаки, дача и экономия — всё проверено на практике.
            </p>
            </div>
            <div style={{ flex: '1 1 520px', minWidth: '280px' }}>
              <HeroSearchControls articles={articlesForClient} categories={categoryOptions} />
            </div>
          </div>
        </section>

        {/* Category chips */}
        <section style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '0.78rem', fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, flexShrink: 0 }}>
            Разделы
          </h2>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {Object.values(CATEGORIES).map((cat) => {
              const color = CATEGORY_COLOR[cat.slug]
              return (
                <Link key={cat.slug} href={`/${cat.slug}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.38rem 0.85rem', borderRadius: '999px',
                  border: `2px solid ${color}55`, fontSize: '0.88rem',
                  color: color, textDecoration: 'none', backgroundColor: color + '12',
                  fontWeight: 700, minHeight: '36px',
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

        {/* FIX 6: "С чего начать" for first-time visitors */}
        <StartHereSection />

        {/* All articles in one grid */}
        {articles.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
                Все статьи
              </h2>
              <Link href="/search" style={{ fontSize: '0.85rem', color: '#c0392b', textDecoration: 'none', fontWeight: 600 }}>
                Все разделы →
              </Link>
            </div>
            <ArticleCatalogGrid articles={articles} />
          </section>
        )}

        {/* F7: Popular articles (localStorage view tracking) */}
        <PopularArticles articles={popularArticleData} />

        {/* Personalised "Для вас" section */}
        <PersonalisedSection articles={articlesForClient} />

        {/* RSS link — compact */}
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#aaa' }}>
          📡 <Link href="/feed.xml" style={{ color: '#aaa' }}>RSS-лента</Link>
        </div>

      </div>
    </>
  )
}
