export const dynamicParams = false
export const revalidate = false
import { getArticlesByCategory, CATEGORIES } from '@/lib/articles'
import CategoryArticleBrowser from '@/components/CategoryArticleBrowser'
import Breadcrumb from '@/components/Breadcrumb'
import CategorySubscriptionCta from '@/components/subscriptions/CategorySubscriptionCta'
import CategoryPushSubscribe from '@/components/CategoryPushSubscribe'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE_NAME, SITE_URL, canonicalPath } from '@/lib/seo'
const CATEGORY_EMOJI: Record<string, string> = {
  kulinaria: '🍲', 'dom-i-uborka': '🧹', 'dacha-i-ogorod': '🌱', layfkhaki: '💡', ekonomiya: '💰', rybalka: '🎣',
  'zdorovie-i-bezopasnost': '🛡️', 'semya-i-deti': '👨‍👩‍👧‍👦', 'krasota-i-uhod': '🌸', 'otdyh-i-puteshestviya': '🧳', 'pokupki-i-tehnika': '📦',
}

interface Props { params: Promise<{ category: string }> }

export async function generateStaticParams() {
  return Object.keys(CATEGORIES).map((slug) => ({ category: slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const cat = CATEGORIES[category]
  if (!cat) return {}
  const url = canonicalPath(`/${category}/`)
  return {
    title: `${cat.name} — советы и лайфхаки`,
    description: cat.description,
    alternates: { canonical: url },
    openGraph: { title: `${cat.name} | ${SITE_NAME}`, description: cat.description, url },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  const cat = CATEGORIES[category]
  if (!cat) notFound()

  const articles = getArticlesByCategory(category)
  const emoji = CATEGORY_EMOJI[category] || '📄'

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: cat.name, item: canonicalPath(`/${category}/`) },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        <Breadcrumb items={[{ name: cat.name }]} />

        <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '2.5rem' }}>{emoji}</span>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.3rem' }}>{cat.name}</h1>
            <p style={{ color: '#777', fontSize: '0.95rem', margin: 0 }}>
              {cat.description} · {articles.length} {articles.length === 1 ? 'статья' : articles.length < 5 ? 'статьи' : 'статей'}
            </p>
            <div style={{ marginTop: '0.75rem' }}>
              <CategorySubscriptionCta
                categorySlug={category}
                categoryName={cat.name}
                placement="category-header"
              />
              <div style={{ marginTop: '0.5rem' }}>
                <CategoryPushSubscribe category={category} />
              </div>
            </div>
          </div>
        </header>

        {articles.length === 0 ? (
          <p style={{ color: '#888' }}>Статьи в этом разделе появятся скоро.</p>
        ) : (
          <CategoryArticleBrowser articles={articles} />
        )}

        {/* Server-rendered crawlable link to the full dynamic listing of this
            category (hub page served by the renderer worker). This is the
            navigation chain that lets search bots reach dynamically published
            articles without JavaScript. */}
        <nav aria-label="Полный список материалов рубрики" style={{ marginTop: '2rem', padding: '1rem 1.25rem', background: '#fff', border: '1px solid #eae4db', borderRadius: '10px' }}>
          <a href={`/stati/${category}/`} style={{ color: '#2980b9', textDecoration: 'none', fontWeight: 700, fontSize: '0.95rem' }}>
            Все материалы рубрики «{cat.name}», включая новые →
          </a>
          <p style={{ margin: '0.4rem 0 0', color: '#888', fontSize: '0.82rem' }}>
            Полный хронологический список опубликованных статей рубрики с пагинацией.
          </p>
        </nav>
      </div>
    </>
  )
}
