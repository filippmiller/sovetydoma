import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllArticles } from '@/lib/articles'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'
import Breadcrumb from '@/components/Breadcrumb'
import { SITE_NAME, SITE_URL, canonicalPath } from '@/lib/seo'
import { notFound } from 'next/navigation'

export const dynamicParams = false

const PAGE_SIZE = 24

interface Props { params: Promise<{ page: string }> }

export async function generateStaticParams() {
  const total = getAllArticles().length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  return Array.from({ length: totalPages - 1 }, (_, i) => ({ page: String(i + 2) })) // 2..N (page 1 is /articles/)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page: pageStr } = await params
  const p = parseInt(pageStr, 10)
  if (!Number.isFinite(p) || p < 2) return {}
  const url = canonicalPath(`/articles/page/${p}/`)
  return {
    title: `Все статьи — страница ${p}`,
    description: `Лента практичных советов, страница ${p}.`,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
  }
}

export default async function ArticlesPaginatedPage({ params }: Props) {
  const { page: pageStr } = await params
  const p = parseInt(pageStr, 10)
  if (!Number.isFinite(p) || p < 2) notFound()

  const all = getAllArticles()
  const total = all.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (p > totalPages) notFound()

  const start = (p - 1) * PAGE_SIZE
  const pageArticles = all.slice(start, start + PAGE_SIZE)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Все статьи — страница ${p}`,
    url: `${SITE_URL}/articles/page/${p}/`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        <Breadcrumb items={[
          { name: 'Все статьи', href: '/articles/' },
          { name: `Страница ${p}` },
        ]} />

        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0 0 0.3rem' }}>
            Все статьи — страница {p}
          </h1>
          <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>
            Показано {start + 1}–{Math.min(start + PAGE_SIZE, total)} из {total}
          </p>
        </header>

        <ArticleCatalogGrid articles={pageArticles} />

        <nav style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }} aria-label="Пагинация">
          {p > 2 && (
            <Link href={`/articles/page/${p - 1}/`} style={{ padding: '0.4rem 0.9rem', border: '1px solid #d8d0c8', borderRadius: '6px', textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}>
              ← Предыдущая
            </Link>
          )}
          <Link href="/articles/" style={{ padding: '0.4rem 0.9rem', border: '1px solid #d8d0c8', borderRadius: '6px', textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}>
            1
          </Link>
          <span style={{ color: '#777', fontSize: '0.9rem' }}>… страница {p} из {totalPages}</span>
          {p < totalPages && (
            <Link href={`/articles/page/${p + 1}/`} style={{ padding: '0.4rem 0.9rem', border: '1px solid #d8d0c8', borderRadius: '6px', textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}>
              Следующая →
            </Link>
          )}
          {p < totalPages - 1 && (
            <Link href={`/articles/page/${totalPages}/`} style={{ padding: '0.4rem 0.9rem', border: '1px solid #d8d0c8', borderRadius: '6px', textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}>
              Последняя ({totalPages})
            </Link>
          )}
        </nav>

        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#888' }}>
          <Link href="/archive/" style={{ color: '#c0392b' }}>Смотреть по месяцам (архив)</Link>
        </p>
      </div>
    </>
  )
}
