import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllArticles } from '@/lib/articles'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'
import Breadcrumb from '@/components/Breadcrumb'
import { SITE_NAME, SITE_URL, canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Все статьи — СоветыДома',
  description: 'Полная лента практичных советов: кулинария, дом, дача, экономия, безопасность, семья, покупки и отдых. Новые статьи первыми.',
  alternates: { canonical: canonicalPath('/articles/') },
  openGraph: {
    title: 'Все статьи | 1001sovet.ru',
    description: 'Архив и лента всех материалов сайта: от рецептов до лайфхаков по безопасности и экономии.',
    url: canonicalPath('/articles/'),
  },
}

const PAGE_SIZE = 24

export default function AllArticlesPage() {
  const all = getAllArticles() // already newest first
  const total = all.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageArticles = all.slice(0, PAGE_SIZE)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Все статьи',
    url: `${SITE_URL}/articles/`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    numberOfItems: total,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        <Breadcrumb items={[{ name: 'Все статьи' }]} />

        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.35rem' }}>Все статьи</h1>
          <p style={{ color: '#666', margin: 0, fontSize: '0.95rem' }}>
            {total} {total === 1 ? 'статья' : total < 5 ? 'статьи' : 'статей'} · сортировка по дате (новые сверху)
          </p>
        </header>

        <ArticleCatalogGrid articles={pageArticles} />

        {totalPages > 1 && (
          <nav style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }} aria-label="Пагинация">
            <span style={{ color: '#777', fontSize: '0.9rem', marginRight: '0.5rem' }}>
              Страница 1 из {totalPages}
            </span>
            <Link
              href="/articles/page/2/"
              style={{ padding: '0.4rem 0.9rem', border: '1px solid #d8d0c8', borderRadius: '6px', textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}
            >
              Следующая →
            </Link>
            <Link
              href={`/articles/page/${totalPages}/`}
              style={{ padding: '0.4rem 0.9rem', border: '1px solid #d8d0c8', borderRadius: '6px', textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}
            >
              Последняя ({totalPages})
            </Link>
          </nav>
        )}

        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#888' }}>
          Полная лента доступна для поиска и архивов. Для фильтров по разделам используйте <Link href="/search/" style={{ color: '#c0392b' }}>поиск</Link>.
        </p>
      </div>
    </>
  )
}
