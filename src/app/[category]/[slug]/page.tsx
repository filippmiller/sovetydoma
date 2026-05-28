import { getArticle, getAllSlugs, CATEGORIES } from '@/lib/articles'
import Breadcrumb from '@/components/Breadcrumb'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import type { Metadata } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sovetydoma.ru'

interface Props {
  params: Promise<{ category: string; slug: string }>
}

export async function generateStaticParams() {
  return getAllSlugs()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  const article = getArticle(category, slug)
  if (!article) return {}

  const { frontmatter: fm } = article
  const url = `${SITE_URL}/${category}/${slug}`

  return {
    title: fm.title,
    description: fm.description,
    alternates: { canonical: url },
    openGraph: {
      title: fm.title,
      description: fm.description,
      url,
      type: 'article',
      publishedTime: fm.date,
      tags: fm.tags,
    },
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CATEGORY_COLORS: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
}

export default async function ArticlePage({ params }: Props) {
  const { category, slug } = await params
  const article = getArticle(category, slug)
  if (!article) notFound()

  const { frontmatter: fm, content } = article
  const cat = CATEGORIES[category]
  const color = CATEGORY_COLORS[category] || '#888'
  const url = `${SITE_URL}/${category}/${slug}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    description: fm.description,
    datePublished: fm.date,
    dateModified: fm.date,
    author: { '@type': 'Organization', name: 'СоветыДома' },
    publisher: {
      '@type': 'Organization',
      name: 'СоветыДома',
      url: SITE_URL,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: fm.tags.join(', '),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: cat?.name || fm.categoryName, item: `${SITE_URL}/${category}` },
      { '@type': 'ListItem', position: 3, name: fm.title, item: url },
    ],
  }

  const vkShareUrl = `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(fm.title)}`
  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(fm.title)}`

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr min(720px, 100%)', justifyContent: 'center' }}>
          <div style={{ gridColumn: '2' }}>
            <Breadcrumb
              items={[
                { name: cat?.name || fm.categoryName, href: `/${category}` },
                { name: fm.title },
              ]}
            />

            {/* Article header */}
            <header style={{ marginBottom: '2rem' }}>
              <span style={{
                display: 'inline-block',
                backgroundColor: color + '18',
                color,
                borderRadius: '4px',
                padding: '3px 10px',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '1rem',
              }}>
                {cat?.name || fm.categoryName}
              </span>

              <h1 style={{
                fontSize: '2rem',
                fontWeight: 800,
                lineHeight: 1.3,
                color: '#1a1a1a',
                marginBottom: '0.75rem',
              }}>
                {fm.title}
              </h1>

              <p style={{ fontSize: '1.05rem', color: '#666', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                {fm.description}
              </p>

              <time style={{ fontSize: '0.85rem', color: '#999' }}>
                {formatDate(fm.date)}
              </time>
            </header>

            {/* Article body */}
            <article className="prose">
              <MDXRemote source={content} />
            </article>

            {/* Tags */}
            {fm.tags.length > 0 && (
              <div style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {fm.tags.map((tag) => (
                  <span key={tag} style={{
                    padding: '3px 10px',
                    borderRadius: '4px',
                    backgroundColor: '#f0ede8',
                    color: '#666',
                    fontSize: '0.8rem',
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Share buttons */}
            <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: '0.9rem' }}>Поделиться:</span>
              <a
                href={vkShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 1rem',
                  backgroundColor: '#4a76a8',
                  color: '#fff',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}
              >
                ВКонтакте
              </a>
              <a
                href={tgShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 1rem',
                  backgroundColor: '#229ED9',
                  color: '#fff',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}
              >
                Telegram
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
