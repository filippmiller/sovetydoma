export const dynamicParams = false
export const revalidate = false
import Link from 'next/link'
import { getArticle, getAllSlugs, getAllArticles, CATEGORIES } from '@/lib/articles'
import Breadcrumb from '@/components/Breadcrumb'
import RelatedArticles from '@/components/RelatedArticles'
import MoreArticles from '@/components/MoreArticles'
import Comments from '@/components/Comments'
import BookmarkButton from '@/components/BookmarkButton'
import TableOfContents from '@/components/TableOfContents'
import ReadingProgress from '@/components/ReadingProgress'
import FontSizeControl from '@/components/FontSizeControl'
import ViewTracker from '@/components/ViewTracker'
import CostBadge from '@/components/CostBadge'
import ArticleChecklist from '@/components/ArticleChecklist'
import PrintRecipeButton from '@/components/PrintRecipeButton'
import ArticleReactions from '@/components/ArticleReactions'
import ViewedCategoryTracker from '@/components/ViewedCategoryTracker'
import SponsoredBadge from '@/components/SponsoredBadge'
import AffiliateLink from '@/components/AffiliateLink'
import RecipeCard from '@/components/RecipeCard'
import ArticleSeries from '@/components/ArticleSeries'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import type { Metadata } from 'next'
import { readingTime, formatDate, relativeDate, CATEGORY_COLOR } from '@/lib/utils'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pogovorim.vsedomatut.com'

interface Props { params: Promise<{ category: string; slug: string }> }

export async function generateStaticParams() { return getAllSlugs() }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  const article = getArticle(category, slug)
  if (!article) return {}
  const { frontmatter: fm } = article
  const cat = CATEGORIES[category]
  const url = `${SITE_URL}/${category}/${slug}`
  const ogUrl = `${SITE_URL}/api/og?title=${encodeURIComponent(fm.title)}&category=${category}&categoryName=${encodeURIComponent(cat?.name || fm.categoryName)}`
  return {
    title: fm.title,
    description: fm.description,
    alternates: { canonical: url },
    keywords: fm.tags.join(', '),
    openGraph: {
      title: fm.title,
      description: fm.description,
      url,
      type: 'article',
      publishedTime: fm.date,
      tags: fm.tags,
      images: [{ url: ogUrl, width: 1200, height: 630, alt: fm.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fm.title,
      description: fm.description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { category, slug } = await params
  const article = getArticle(category, slug)
  if (!article) notFound()

  const { frontmatter: fm, content, wordCount } = article
  const cat = CATEGORIES[category]
  const color = CATEGORY_COLOR[category] || '#888'
  const url = `${SITE_URL}/${category}/${slug}`
  const timeToRead = readingTime('x '.repeat(wordCount))

  // F7+F9: all articles needed for ViewTracker slug + tag-based similarity
  const allArticles = getAllArticles()
  const otherArticles = allArticles
    .filter((a) => a.slug !== slug && a.category !== category)
    .slice(0, 6)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    description: fm.description,
    datePublished: fm.date,
    dateModified: fm.date,
    author: { '@type': 'Organization', name: 'СоветыДома', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'СоветыДома', url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: fm.tags.join(', '),
    inLanguage: 'ru-RU',
    wordCount,
    timeRequired: `PT${Math.max(1, Math.round(wordCount / 180))}M`,
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

  // FAQ schema — detect H2/H3 headings ending with "?"
  const faqEntities: { '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }[] = []
  const contentLines = content.split('\n')
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i]
    const headingMatch = line.match(/^#{2,3} (.+)$/)
    if (headingMatch) {
      const headingText = headingMatch[1].trim()
      if (headingText.endsWith('?')) {
        const bodyLines: string[] = []
        for (let j = i + 1; j < contentLines.length; j++) {
          if (/^#{1,6} /.test(contentLines[j])) break
          bodyLines.push(contentLines[j])
        }
        const answerText = bodyLines
          .join('\n').split('\n\n')
          .map((p) => p.replace(/^#+\s/, '').replace(/[*_`]/g, '').trim())
          .find((p) => p.length > 0) || ''
        if (answerText) {
          faqEntities.push({
            '@type': 'Question',
            name: headingText,
            acceptedAnswer: { '@type': 'Answer', text: answerText },
          })
        }
      }
    }
  }
  const faqSchema = faqEntities.length >= 2
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqEntities }
    : null

  // Additional structured data: Recipe or HowTo
  let additionalSchema: object | null = null
  if (fm.schemaType === 'Recipe') {
    additionalSchema = {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: fm.title,
      description: fm.description,
      author: { '@type': 'Organization', name: 'СоветыДома', url: SITE_URL },
      datePublished: fm.date,
      image: fm.image ? `${SITE_URL}${fm.image}` : undefined,
      prepTime: fm.prepTime,
      cookTime: fm.cookTime,
      recipeYield: fm.recipeYield,
      recipeIngredient: fm.recipeIngredient || [],
      keywords: fm.tags.join(', '),
      inLanguage: 'ru-RU',
    }
  } else if (fm.schemaType === 'HowTo') {
    const steps = [...content.matchAll(/^## (.+)$/gm)].map((m, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: m[1].trim(),
    }))
    additionalSchema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: fm.title,
      description: fm.description,
      step: steps,
      inLanguage: 'ru-RU',
    }
  }

  const vkUrl = `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(fm.title)}`
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(fm.title)}`
  const waUrl = `https://wa.me/?text=${encodeURIComponent(fm.title + ' ' + url)}`

  return (
    <>
      {/* F2: Reading progress bar */}
      <ReadingProgress show />

      {/* F7: View tracker for popular articles */}
      <ViewTracker slug={slug} />

      {/* Personalisation: track viewed category */}
      <ViewedCategoryTracker category={category} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {additionalSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(additionalSchema) }} />
      )}
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}

      {/* Category color stripe */}
      <div style={{ height: '4px', background: `linear-gradient(90deg, ${color}, ${color}88)` }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        <div className="article-layout">
          <div className="article-main">
            <Breadcrumb items={[
              { name: cat?.name || fm.categoryName, href: `/${category}` },
              { name: fm.title },
            ]} />

            {/* Article series navigation */}
            {fm.seriesName && (
              <ArticleSeries
                seriesName={fm.seriesName}
                currentSlug={slug}
                allArticles={allArticles}
              />
            )}

            {fm.sponsored && <SponsoredBadge />}

            <header style={{ marginBottom: '1.75rem' }}>
              <span style={{
                display: 'inline-block',
                backgroundColor: color + '18', color,
                borderRadius: '4px', padding: '3px 10px',
                fontSize: '0.78rem', fontWeight: 700,
                marginBottom: '0.9rem',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {cat?.name || fm.categoryName}
              </span>

              <h1 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.3, color: '#1a1a1a', marginBottom: '0.75rem' }}>
                {fm.title}
              </h1>

              <p style={{ fontSize: '1.05rem', color: '#666', lineHeight: 1.65, marginBottom: '0.9rem' }}>
                {fm.description}
              </p>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.83rem', color: '#767676', flexWrap: 'wrap' }}>
                <time dateTime={fm.date} title={formatDate(fm.date)} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>📅 {formatDate(fm.date)} <span style={{ opacity: 0.7 }}>({relativeDate(fm.date)})</span></span>
                  {fm.updated && (
                    <span>🔄 Обновлено: {formatDate(fm.updated)}</span>
                  )}
                </time>
                <span>⏱ {timeToRead}</span>
                <span>📝 {wordCount} слов</span>
                {fm.cost && <CostBadge cost={fm.cost} />}
                <FontSizeControl />
                <BookmarkButton slug={slug} title={fm.title} />
              </div>
            </header>

            <div className="toc-inline">
              <TableOfContents content={content} />
            </div>

            {/* Visual recipe card — shown for Recipe articles with ingredients */}
            {fm.schemaType === 'Recipe' && fm.recipeIngredient && (
              <RecipeCard
                prepTime={fm.prepTime}
                cookTime={fm.cookTime}
                recipeYield={fm.recipeYield}
                recipeIngredient={fm.recipeIngredient}
                recipeSteps={fm.recipeSteps}
                difficulty={fm.difficulty}
              />
            )}

            <article className="prose">
              <MDXRemote source={content} components={{ ArticleChecklist, AffiliateLink }} />
            </article>

            {/* Tags */}
            {fm.tags.length > 0 && (
              <div style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {fm.tags.map((tag) => (
                  <Link key={tag} href={`/tag/${encodeURIComponent(tag)}/`}
                    style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: '#f0ede8', color: '#666', fontSize: '0.8rem', textDecoration: 'none' }}>
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {/* Article reactions */}
            <ArticleReactions slug={slug} />

            {/* Print button for recipes */}
            {fm.schemaType === 'Recipe' && <PrintRecipeButton />}

            {/* Share buttons */}
            <div className="share-buttons" style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#767676', fontSize: '0.88rem', fontWeight: 600 }}>Поделиться:</span>
              {[
                { href: vkUrl, label: 'ВКонтакте', bg: '#4a76a8' },
                { href: tgUrl, label: 'Telegram', bg: '#229ED9' },
                { href: waUrl, label: 'WhatsApp', bg: '#25D366' },
              ].map(({ href, label, bg }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  aria-label={`Поделиться в ${label}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', backgroundColor: bg, color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500 }}>
                  {label}
                </a>
              ))}
            </div>

            <RelatedArticles articles={allArticles} currentSlug={slug} currentTags={fm.tags} />
            <MoreArticles articles={allArticles.filter(a => a.category !== category && a.slug !== slug).slice(0, 6)} />
            <Comments slug={slug} />
          </div>

          {/* Sidebar TOC (desktop only) */}
          <div className="article-sidebar">
            <TableOfContents content={content} sidebar />
          </div>
        </div>
      </div>
    </>
  )
}
