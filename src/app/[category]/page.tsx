export const dynamicParams = false
export const revalidate = false
import { getArticlesByCategory, CATEGORIES } from '@/lib/articles'
import ArticleCard from '@/components/ArticleCard'
import Breadcrumb from '@/components/Breadcrumb'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pogovorimdoma.ru'
const CATEGORY_EMOJI: Record<string, string> = {
  kulinaria: '🍲', 'dom-i-uborka': '🧹', 'dacha-i-ogorod': '🌱', layfkhaki: '💡', ekonomiya: '💰', rybalka: '🎣',
}

interface Props { params: Promise<{ category: string }> }

export async function generateStaticParams() {
  return Object.keys(CATEGORIES).map((slug) => ({ category: slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const cat = CATEGORIES[category]
  if (!cat) return {}
  const url = `${SITE_URL}/${category}`
  return {
    title: `${cat.name} — советы и лайфхаки`,
    description: cat.description,
    alternates: { canonical: url },
    openGraph: { title: `${cat.name} | СоветыДома`, description: cat.description, url },
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
      { '@type': 'ListItem', position: 2, name: cat.name, item: `${SITE_URL}/${category}` },
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
          </div>
        </header>

        {articles.length === 0 ? (
          <p style={{ color: '#888' }}>Статьи в этом разделе появятся скоро.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {articles.map((article) => (
              <ArticleCard key={article.slug} article={article} wordCount={article.wordCount} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
