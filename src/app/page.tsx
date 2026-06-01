import { getAllArticles } from '@/lib/articles'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'
import SeasonalBanner from '@/components/SeasonalBanner'
import PopularArticles from '@/components/PopularArticles'
import PersonalisedSection from '@/components/PersonalisedSection'
import StartHereSection from '@/components/StartHereSection'
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

export default function HomePage() {
  const articles = getAllArticles()

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
          borderRadius: '8px',
          padding: '0.72rem 1rem',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
          zIndex: 1,
          minHeight: '74px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '30px 30px',
          }} />
          <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.72, margin: '0 0 0.22rem' }}>
              Практичные советы для дома
            </p>
            <h1 style={{ fontSize: 'clamp(1.1rem, 2.3vw, 1.45rem)', fontWeight: 800, lineHeight: 1.18, margin: '0 0 0.18rem' }}>
              Полезные советы на каждый день
            </h1>
            <p style={{ fontSize: '0.88rem', opacity: 0.86, margin: 0, maxWidth: '620px', lineHeight: 1.4 }}>
              Рецепты, лайфхаки, дача и экономия — всё проверено на практике.
            </p>
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
