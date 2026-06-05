import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllArticles } from '@/lib/articles'
import Breadcrumb from '@/components/Breadcrumb'
import { SITE_NAME, SITE_URL, canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Архив статей — по месяцам',
  description: 'Архив практичных советов по месяцам публикации. Выберите период, чтобы увидеть все материалы за месяц.',
  alternates: { canonical: canonicalPath('/archive/') },
  openGraph: {
    title: 'Архив статей | 1001sovet.ru',
    description: 'Все материалы сайта, сгруппированные по месяцам.',
    url: canonicalPath('/archive/'),
  },
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}

export default function ArchiveIndexPage() {
  const all = getAllArticles()
  const byMonth: Record<string, number> = {}
  all.forEach((a) => {
    const d = a.date || ''
    const ym = d.slice(0, 7) // YYYY-MM
    if (ym.length === 7) byMonth[ym] = (byMonth[ym] || 0) + 1
  })
  const months = Object.keys(byMonth).sort().reverse()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Архив статей',
    url: `${SITE_URL}/archive/`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        <Breadcrumb items={[{ name: 'Архив' }]} />

        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.35rem' }}>Архив статей</h1>
          <p style={{ color: '#666', margin: 0 }}>Материалы по месяцам публикации. Только реальные периоды с контентом.</p>
        </header>

        {months.length === 0 ? (
          <p>Архив пока пуст.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
            {months.map((ym) => (
              <li key={ym}>
                <Link
                  href={`/archive/${ym}/`}
                  style={{
                    display: 'block',
                    padding: '0.65rem 0.9rem',
                    border: '1px solid #e8e4df',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: '#222',
                    background: '#fff',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{formatMonth(ym)}</span>
                  <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                    {byMonth[ym]} {byMonth[ym] === 1 ? 'статья' : 'статей'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#777' }}>
          Полная лента: <Link href="/articles/" style={{ color: '#c0392b' }}>все статьи</Link>.
        </p>
      </div>
    </>
  )
}
