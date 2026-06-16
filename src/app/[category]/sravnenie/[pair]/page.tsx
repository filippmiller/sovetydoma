import Link from 'next/link'
import { getAllArticles, getArticle, CATEGORIES } from '@/lib/articles'
import { generateComparisonPairs } from '@/lib/comparison-pairs.mjs'
import Breadcrumb from '@/components/Breadcrumb'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { SITE_NAME, SITE_URL } from '@/lib/seo'
import { CATEGORY_COLOR } from '@/lib/utils'

interface Props {
  params: Promise<{ category: string; pair: string }>
}

const MAX_COMPARISON_PAIRS = 200
const MAX_PER_CATEGORY = 20

function parsePair(pair: string): { a: string; b: string } | null {
  const parts = pair.split('-ili-')
  if (parts.length !== 2) return null
  const [a, b] = parts
  if (!a || !b) return null
  return { a, b }
}

export async function generateStaticParams() {
  const articles = getAllArticles()
  const pairs = generateComparisonPairs(articles, MAX_COMPARISON_PAIRS, MAX_PER_CATEGORY)
  console.log(`[comparisons] generated ${pairs.length} pairs (cap ${MAX_COMPARISON_PAIRS})`)
  return pairs.map((p) => ({ category: p.category, pair: `${p.a}-ili-${p.b}` }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, pair } = await params
  const parsed = parsePair(pair)
  if (!parsed) return {}
  const cat = CATEGORIES[category]
  const a = getArticle(category, parsed.a)
  const b = getArticle(category, parsed.b)
  if (!a || !b) return {}
  const title = `${a.frontmatter.title} или ${b.frontmatter.title}: что выбрать — ${cat?.name || category}`
  const description = `Сравниваем «${a.frontmatter.title}» и «${b.frontmatter.title}». ${a.frontmatter.description.slice(0, 80)}…`
  const url = `${SITE_URL}/${category}/sravnenie/${pair}/`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'article' },
  }
}

export default async function ComparisonPage({ params }: Props) {
  const { category, pair } = await params
  const parsed = parsePair(pair)
  if (!parsed) notFound()
  const cat = CATEGORIES[category]
  const a = getArticle(category, parsed.a)
  const b = getArticle(category, parsed.b)
  if (!a || !b) notFound()

  const aFm = a.frontmatter
  const bFm = b.frontmatter
  const url = `${SITE_URL}/${category}/sravnenie/${pair}/`
  const color = CATEGORY_COLOR[category] || '#888'

  const title = `${aFm.title} или ${bFm.title}`
  const shared = aFm.tags.filter((t) => bFm.tags.includes(t))
  const onlyA = aFm.tags.filter((t) => !bFm.tags.includes(t))
  const onlyB = bFm.tags.filter((t) => !aFm.tags.includes(t))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: `Сравнение «${aFm.title}» и «${bFm.title}».`,
    url,
    datePublished: aFm.date,
    dateModified: aFm.updated || aFm.date,
    inLanguage: 'ru-RU',
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: cat?.name || category, item: `${SITE_URL}/${category}/` },
      { '@type': 'ListItem', position: 3, name: title, item: url },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        <Breadcrumb items={[{ name: cat?.name || category, href: `/${category}/` }, { name: title }]} />

        <header style={{ marginBottom: '2rem' }}>
          <span style={{
            display: 'inline-block',
            backgroundColor: color + '18', color,
            borderRadius: '4px', padding: '3px 10px',
            fontSize: '0.78rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            marginBottom: '0.75rem',
          }}>
            Сравнение
          </span>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.75rem' }}>
            {title}: что выбрать
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#666', lineHeight: 1.65, margin: 0 }}>
            Сравниваем два материала из раздела «{cat?.name || category}» и помогаем выбрать подходящий вариант.
          </p>
        </header>

        <article className="prose" style={{ maxWidth: '760px' }}>
          <h2>Краткое сравнение</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', border: '1px solid #ece3d8', borderRadius: '8px', background: '#fbf7f2' }}>
              <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>{aFm.title}</h3>
              <p style={{ marginBottom: 0, color: '#555' }}>{aFm.description}</p>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #ece3d8', borderRadius: '8px', background: '#fbf7f2' }}>
              <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>{bFm.title}</h3>
              <p style={{ marginBottom: 0, color: '#555' }}>{bFm.description}</p>
            </div>
          </div>

          {shared.length > 0 && (
            <>
              <h2>Общее</h2>
              <p>{shared.map((t) => `#${t}`).join(', ')}</p>
            </>
          )}

          <h2>Отличия</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem' }}>{aFm.title}</h3>
              <ul>
                {onlyA.slice(0, 6).map((t) => <li key={t}>#{t}</li>)}
                {onlyA.length === 0 && <li>Уникальные темы не выделены</li>}
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: '1rem' }}>{bFm.title}</h3>
              <ul>
                {onlyB.slice(0, 6).map((t) => <li key={t}>#{t}</li>)}
                {onlyB.length === 0 && <li>Уникальные темы не выделены</li>}
              </ul>
            </div>
          </div>

          <h2>Источники</h2>
          <ul>
            <li>
              <Link href={`/${category}/${aFm.slug}/`}>{aFm.title}</Link>
            </li>
            <li>
              <Link href={`/${category}/${bFm.slug}/`}>{bFm.title}</Link>
            </li>
          </ul>
        </article>
      </div>
    </>
  )
}
