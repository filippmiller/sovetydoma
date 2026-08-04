import { getAllArticles, getArticlesByCategory, getJustNowArticles } from '@/lib/articles'
import { CATEGORIES } from '@/lib/categories'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'
import SeasonalBanner from '@/components/SeasonalBanner'
import PopularArticles from '@/components/PopularArticles'
import ReadingNow from '@/components/ReadingNow'
import CategoryTiles from '@/components/CategoryTiles'
import LatestPublished from '@/components/LatestPublished'
import FunWidget from '@/components/FunWidget'
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

const HOMEPAGE_ARTICLE_LIMIT = 24
const POPULAR_ARTICLE_LIMIT = 100
const PERSONALISED_ARTICLE_LIMIT = 100
const JUST_NOW_LIMIT = 8
const JUST_NOW_POOL = 60
const READING_NOW_LIMIT = 5
const ARTICLES_PER_CATEGORY_TILE = 3
const LATEST_ARTICLES_POOL = 300

export default function HomePage() {
  const allArticles = getAllArticles()
  const justNowArticles = getJustNowArticles(JUST_NOW_LIMIT, JUST_NOW_POOL)
  // "Последние статьи" gets the same round-robin-by-category treatment as
  // "Только что" (otherwise it's still just a wall of whichever category
  // publishes most), excluding what's already shown above it so the two
  // sections don't repeat the same cards.
  const articles = getJustNowArticles(
    HOMEPAGE_ARTICLE_LIMIT,
    LATEST_ARTICLES_POOL,
    new Set(justNowArticles.map((a) => a.slug)),
  )
  const categoryTiles = Object.keys(CATEGORIES).map((slug) => ({
    slug,
    articles: getArticlesByCategory(slug).slice(0, ARTICLES_PER_CATEGORY_TILE),
  }))

  const popularArticleData = allArticles
    .slice(0, POPULAR_ARTICLE_LIMIT)
    .map((a) => ({
      title: a.title,
      slug: a.slug,
      category: a.category,
      categoryName: a.categoryName,
      date: a.date,
    }))

  // Same shape as popularArticleData but scoped to only the most recent pool
  // (JUST_NOW_POOL), so "Читают сейчас" ranks what's trending among fresh
  // content rather than duplicating the all-time "Популярное" list below.
  const readingNowArticleData = popularArticleData.slice(0, JUST_NOW_POOL)

  const articlesForClient = allArticles
    .slice(0, PERSONALISED_ARTICLE_LIMIT)
    .map((a) => ({
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

        {/* "Новое" — genuinely just-published articles, pulled live from the
            content factory's Supabase table via a small renderer-worker API
            (the static build below can't see today's dynamic publishes at
            all — see LatestPublished.tsx for why). This is real "new", not
            positional. */}
        <LatestPublished />

        {/* "Читают сейчас" — trending among recently published articles (Supabase view counts) */}
        <ReadingNow articles={readingNowArticleData} limit={READING_NOW_LIMIT} />

        {/* "Только что" — most recent articles round-robin'd across categories so
            one heavily-published section (e.g. Авто) doesn't crowd out the rest */}
        {justNowArticles.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.2rem' }}>
                🔀 Только что
              </h2>
              <p style={{ fontSize: '0.83rem', color: '#999', margin: 0 }}>
                Свежее из разных разделов — не только из одной рубрики
              </p>
            </div>
            <ArticleCatalogGrid articles={justNowArticles} />
          </section>
        )}

        {/* "По разделам" — the 12-category structure previously only visible
            in the "Разделы" dropdown menu, now surfaced directly on the page */}
        <CategoryTiles tiles={categoryTiles} />

        {/* F7: Popular articles (localStorage view tracking) — moved up from
            the very bottom of the page, where nobody used to scroll far
            enough to see it */}
        <PopularArticles articles={popularArticleData} />

        {/* Small daily entertainment widget — a reason to linger besides
            "another how-to" */}
        <FunWidget />

        {/* Latest articles */}
        {articles.length > 0 && (
          <section style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
                Последние статьи
              </h2>
              <Link href="/articles" style={{ fontSize: '0.85rem', color: '#c0392b', textDecoration: 'none', fontWeight: 600 }}>
                Все статьи →
              </Link>
            </div>
            <p style={{ fontSize: '0.83rem', color: '#999', margin: '0 0 1.25rem' }}>
              Продолжение ленты — то, что не попало в «Только что» выше
            </p>
            <ArticleCatalogGrid articles={articles} />
          </section>
        )}

        {/* Personalised "Для вас" section */}
        <PersonalisedSection articles={articlesForClient} />

        {/* RSS link — compact */}
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: '#aaa' }}>
           <Link href="/feed.xml" style={{ color: '#aaa' }}>RSS-лента</Link>
        </div>

    </>
  )
}
