import { getAllArticles, getAllTags } from '@/lib/articles'
import ArticleCard from '@/components/ArticleCard'
import Breadcrumb from '@/components/Breadcrumb'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

interface Props { params: Promise<{ tag: string }> }

export async function generateStaticParams() {
  const tags = getAllTags()
  return tags.map(({ tag }) => ({ tag: encodeURIComponent(tag) }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  return {
    title: `#${decoded} — статьи по теме`,
    description: `Все статьи с тегом «${decoded}» на СоветыДома`,
    robots: { index: false },
  }
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params
  const decoded = decodeURIComponent(tag)
  const all = getAllArticles()
  const articles = all.filter((a) => a.tags.includes(decoded))

  if (articles.length === 0) notFound()

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Breadcrumb items={[{ name: `#${decoded}` }]} />
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.3rem' }}>
          #{decoded}
        </h1>
        <p style={{ color: '#777', fontSize: '0.95rem' }}>
          {articles.length} {articles.length === 1 ? 'статья' : articles.length < 5 ? 'статьи' : 'статей'} по этой теме
        </p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {articles.map((a) => <ArticleCard key={a.slug} article={a} wordCount={a.wordCount} />)}
      </div>
    </div>
  )
}
