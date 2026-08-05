import { getAllArticles, getArticlesByCategory, getJustNowArticles } from '@/lib/articles'
import { CATEGORIES } from '@/lib/categories'
import ArticleCard from '@/components/ArticleCard'
import CategoryTiles from '@/components/CategoryTiles'
import HomepageMoreFeed from '@/components/HomepageMoreFeed'
import LatestPublished from '@/components/LatestPublished'
import PopularArticles from '@/components/PopularArticles'
import SeasonalBanner from '@/components/SeasonalBanner'
import StartHereSection from '@/components/StartHereSection'
import ArticlePageShell from '@/components/ArticlePageShell'
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

const HOMEPAGE_ARTICLE_LIMIT = 120
const JUST_NOW_LIMIT = 12
const JUST_NOW_POOL = 60
const LATEST_ARTICLES_POOL = 300
const ARTICLES_PER_CATEGORY_TILE = 3
const POPULAR_ARTICLE_LIMIT = 100

export default function HomePage() {
  const allArticles = getAllArticles()
  const justNowArticles = getJustNowArticles(JUST_NOW_LIMIT, JUST_NOW_POOL)
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

  return (
    <ArticlePageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        <SeasonalBanner />

        <StartHereSection />

        {/* Dynamic latest articles from the content factory */}
        <LatestPublished />

        {/* Main feed */}
        {justNowArticles.length > 0 && (
          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.6rem' }}>
              Свежие советы
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {justNowArticles.map((article, i) => (
                <ArticleCard
                  key={article.slug}
                  article={article}
                  featured={i === 0}
                />
              ))}
            </div>
          </section>
        )}

        <CategoryTiles tiles={categoryTiles} />

        {articles.length > 0 && (
          <section style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
                Ещё советы
              </h2>
              <Link href="/articles" style={{ fontSize: '0.82rem', color: '#c0392b', textDecoration: 'none', fontWeight: 600 }}>
                Все статьи →
              </Link>
            </div>
            <HomepageMoreFeed articles={articles} />
          </section>
        )}

        <PopularArticles articles={popularArticleData} />
      </div>
    </ArticlePageShell>
  )
}
