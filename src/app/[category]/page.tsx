import { getArticlesByCategory, CATEGORIES } from '@/lib/articles'
import ArticleCard from '@/components/ArticleCard'
import Breadcrumb from '@/components/Breadcrumb'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ category: string }>
}

export async function generateStaticParams() {
  return Object.keys(CATEGORIES).map((slug) => ({ category: slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params
  const cat = CATEGORIES[category]
  if (!cat) return {}
  return {
    title: `${cat.name} — советы и лайфхаки`,
    description: cat.description,
    openGraph: {
      title: `${cat.name} | СоветыДома`,
      description: cat.description,
    },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  const cat = CATEGORIES[category]
  if (!cat) notFound()

  const articles = getArticlesByCategory(category)

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Breadcrumb items={[{ name: cat.name }]} />

      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.4rem' }}>
          {cat.name}
        </h1>
        <p style={{ color: '#666', fontSize: '1rem' }}>{cat.description}</p>
      </header>

      {articles.length === 0 ? (
        <p style={{ color: '#888' }}>Статьи в этом разделе появятся скоро.</p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}>
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
