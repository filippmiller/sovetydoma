export const dynamicParams = false
export const revalidate = false
import { getArticlesByCategory, CATEGORIES } from '@/lib/articles'
import { getSubcategoriesFor } from '@/lib/categories'
import { CATEGORY_EMOJI, CATEGORY_COLOR } from '@/lib/utils'
import CategoryArticleBrowser from '@/components/CategoryArticleBrowser'
import Breadcrumb from '@/components/Breadcrumb'
import CategoryFollowControl from '@/components/CategoryFollowControl'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE_NAME, SITE_URL, canonicalPath } from '@/lib/seo'

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
  const subcategories = getSubcategoriesFor(category)

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
        <Breadcrumb items={[{ name: cat.name }]} />

        <header style={{ marginBottom: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/images/categories/${category}.jpg`}
            alt=""
            width={52}
            height={52}
            style={{ width: '52px', height: '52px', flexShrink: 0, borderRadius: '12px', objectFit: 'cover' }}
          />
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.15rem' }}>{cat.name}</h1>
            <p style={{ color: '#888', fontSize: '0.82rem', margin: 0 }}>
              {cat.description} · {articles.length} {articles.length === 1 ? 'статья' : articles.length < 5 ? 'статьи' : 'статей'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <CategoryFollowControl categorySlug={category} categoryName={cat.name} />
            </div>
          </div>
        </header>

        {/* Subcategory tiles */}
        {subcategories.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {subcategories.map((sub) => {
                const emoji = CATEGORY_EMOJI[sub.slug] || '📄'
                const color = CATEGORY_COLOR[sub.slug] || '#888'
                return (
                  <a
                    key={sub.slug}
                    href={`#${sub.slug}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '20px',
                      border: `1.5px solid ${color}33`,
                      backgroundColor: `${color}0a`,
                      color: color,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <span>{emoji}</span>
                    <span>{sub.name}</span>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {articles.length === 0 ? (
          <p style={{ color: '#888' }}>Статьи в этом разделе появятся скоро.</p>
        ) : (
          <CategoryArticleBrowser category={category} articles={articles} />
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
    </>
  )
}
