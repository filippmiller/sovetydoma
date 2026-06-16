import { getAllArticles } from '@/lib/articles'
import Breadcrumb from '@/components/Breadcrumb'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE_NAME, SITE_URL } from '@/lib/seo'

interface Props {
  params: Promise<{ month: string }>
}

const MONTH_NAMES: Record<string, string> = {
  '1': 'Январь',
  '2': 'Февраль',
  '3': 'Март',
  '4': 'Апрель',
  '5': 'Май',
  '6': 'Июнь',
  '7': 'Июль',
  '8': 'Август',
  '9': 'Сентябрь',
  '10': 'Октябрь',
  '11': 'Ноябрь',
  '12': 'Декабрь',
}

export async function generateStaticParams() {
  return Array.from({ length: 12 }, (_, i) => ({ month: String(i + 1) }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params
  const name = MONTH_NAMES[month]
  if (!name) return {}
  const url = `${SITE_URL}/sezon/${month}/`
  const title = `Что делать в ${name.toLowerCase()}е — советы по месяцам — ${SITE_NAME}`
  return {
    title,
    description: `Сезонные советы и лайфхаки для ${name.toLowerCase()}я: дача, огород, дом, уборка, здоровье и быт.`,
    alternates: { canonical: url },
    openGraph: { title, description: `Сезонные материалы для ${name.toLowerCase()}я`, url },
  }
}

export default async function SeasonalMonthPage({ params }: Props) {
  const { month } = await params
  const monthNum = Number.parseInt(month, 10)
  const monthName = MONTH_NAMES[month]
  if (!monthName || Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    notFound()
  }

  const articles = getAllArticles().filter(
    (article) => Array.isArray(article.seasonalMonths) && article.seasonalMonths.includes(monthNum),
  )

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Сезонные советы', item: `${SITE_URL}/sezon/` },
      { '@type': 'ListItem', position: 3, name: monthName, item: `${SITE_URL}/sezon/${month}/` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        <Breadcrumb items={[{ name: 'Сезонные советы', href: '/sezon/' }, { name: monthName }]} />

        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.4rem' }}>
            {monthName}: сезонные советы
          </h1>
          <p style={{ color: '#777', fontSize: '0.95rem', margin: 0 }}>
            {articles.length} {articles.length === 1 ? 'материал' : articles.length < 5 ? 'материала' : 'материалов'} для этого месяца
          </p>
        </header>

        {articles.length === 0 ? (
          <p style={{ color: '#888' }}>Пока нет материалов с привязкой к {monthName.toLowerCase()}ю.</p>
        ) : (
          <ArticleCatalogGrid articles={articles} />
        )}
      </div>
    </>
  )
}
