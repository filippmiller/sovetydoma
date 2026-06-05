import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllArticles } from '@/lib/articles'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'
import Breadcrumb from '@/components/Breadcrumb'
import { SITE_NAME, SITE_URL, canonicalPath } from '@/lib/seo'
import { notFound } from 'next/navigation'

export const dynamicParams = false

interface Props { params: Promise<{ month: string }> }

function isValidMonth(m: string): boolean {
  return /^\d{4}-\d{2}$/.test(m)
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export async function generateStaticParams() {
  const all = getAllArticles()
  const months = new Set<string>()
  all.forEach((a) => {
    const ym = (a.date || '').slice(0, 7)
    if (isValidMonth(ym)) months.add(ym)
  })
  return Array.from(months).sort().map((m) => ({ month: m }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params
  if (!isValidMonth(month)) return {}
  const url = canonicalPath(`/archive/${month}/`)
  return {
    title: `Архив за ${formatMonth(month)}`,
    description: `Статьи, опубликованные в ${formatMonth(month)}. Практичные советы для дома и дачи.`,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
  }
}

export default async function ArchiveMonthPage({ params }: Props) {
  const { month } = await params
  if (!isValidMonth(month)) notFound()

  const all = getAllArticles()
  const monthArticles = all.filter((a) => (a.date || '').slice(0, 7) === month)
  if (monthArticles.length === 0) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Архив за ${formatMonth(month)}`,
    url: `${SITE_URL}/archive/${month}/`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    numberOfItems: monthArticles.length,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        <Breadcrumb items={[
          { name: 'Архив', href: '/archive/' },
          { name: formatMonth(month) },
        ]} />

        <header style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0 0 0.3rem' }}>
            Архив за {formatMonth(month)}
          </h1>
          <p style={{ color: '#666', margin: 0, fontSize: '0.95rem' }}>
            {monthArticles.length} {monthArticles.length === 1 ? 'статья' : monthArticles.length < 5 ? 'статьи' : 'статей'}
            {' · '}
            <Link href="/articles/" style={{ color: '#c0392b' }}>полная лента</Link>
          </p>
        </header>

        <ArticleCatalogGrid articles={monthArticles} />

        <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#777' }}>
          Другие месяцы: <Link href="/archive/" style={{ color: '#c0392b' }}>архив</Link>.
        </p>
      </div>
    </>
  )
}
