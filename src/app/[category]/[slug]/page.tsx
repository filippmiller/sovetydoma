import Link from 'next/link'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { getArticle, getAllSlugs, getAllArticles, CATEGORIES, LEGACY_ARTICLE_MOVES } from '@/lib/articles'
import { resolvePersona } from '@/lib/personas'
import Breadcrumb from '@/components/Breadcrumb'
import RelatedArticles from '@/components/RelatedArticles'
import MoreArticles from '@/components/MoreArticles'
import Comments from '@/components/Comments'
import FavoriteButton from '@/components/FavoriteButton'
import SharePanel from '@/components/SharePanel'
import StarRating from '@/components/StarRating'
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
import ArticleQuickAnswer from '@/components/ArticleQuickAnswer'
import ArticleActionSummary from '@/components/ArticleActionSummary'
import ArticlePersonaCard from '@/components/ArticlePersonaCard'
import ArticleFeedback from '@/components/ArticleFeedback'
import ArticlePhotoSubmissionCTA from '@/components/ArticlePhotoSubmissionCTA'
import ArticleQuestionsBlock from '@/components/ArticleQuestionsBlock'
import ArticleViewCount from '@/components/ArticleViewCount'
import ArticleImage from '@/components/ArticleImage'
import CategorySubscriptionCta from '@/components/subscriptions/CategorySubscriptionCta'
import { ArticleH2, ArticleH3 } from '@/components/ArticleHeading'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import type { Metadata } from 'next'
import { readingTime, formatDate, relativeDate, CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'
import { resolveArticleImage } from '@/lib/cloudinary'
import { SITE_NAME, SITE_URL, articleCanonicalUrl, articleImageUrl, absoluteUrl, truncateForMeta } from '@/lib/seo'
import { getMoreInterestingArticles, getSimilarArticles } from '@/lib/article-recommendations'

interface Props { params: Promise<{ category: string; slug: string }> }

function getLocalJpegDimensions(imagePath: string): { width: number; height: number } | null {
  const normalized = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath
  const filePath = path.join(process.cwd(), 'public', normalized)
  if (!existsSync(filePath)) return null

  const bytes = readFileSync(filePath)
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    const length = bytes.readUInt16BE(offset + 2)
    if (length < 2) return null
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      }
    }
    offset += 2 + length
  }

  return null
}

export async function generateStaticParams() {
  const current = getAllSlugs()
  // Include legacy paths for moved articles so they can serve soft-redirects instead of hard 404
  const legacy = Object.entries(LEGACY_ARTICLE_MOVES).map(([slug, m]) => ({ category: m.oldCategory, slug }))
  // Dedupe just in case
  const seen = new Set(current.map((s) => `${s.category}/${s.slug}`))
  const extras = legacy.filter((s) => !seen.has(`${s.category}/${s.slug}`))
  return [...current, ...extras]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params
  let article = getArticle(category, slug)
  let isLegacy = false
  let canonicalOverride: string | null = null
  if (!article) {
    const move = LEGACY_ARTICLE_MOVES[slug]
    if (move && move.oldCategory === category) {
      const candidate = getArticle(move.newCategory, slug)
      if (candidate) {
        article = candidate
        isLegacy = true
        canonicalOverride = `${SITE_URL}/${move.newCategory}/${slug}/`
      }
    }
  }
  if (!article) return {}
  const { frontmatter: fm } = article
  const cat = CATEGORIES[category] || CATEGORIES[article.frontmatter.category]
  const url = canonicalOverride || articleCanonicalUrl(fm)
  const imageUrl = articleImageUrl(fm)
  const imageDimensions = getLocalJpegDimensions(`/images/${fm.slug}.jpg`) || { width: 1200, height: 630 }
  const description = truncateForMeta(fm.description)
  return {
    title: fm.title,
    description,
    alternates: { canonical: url },
    keywords: fm.tags.join(', '),
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    category: cat?.name || fm.categoryName,
    robots: isLegacy ? { index: false, follow: true } : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title: fm.title,
      description,
      url,
      type: 'article',
      publishedTime: fm.date,
      modifiedTime: fm.updated || fm.date,
      section: cat?.name || fm.categoryName,
      tags: fm.tags,
      images: [{ url: imageUrl, ...imageDimensions, alt: fm.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fm.title,
      description,
      images: [{ url: imageUrl, ...imageDimensions }],
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { category, slug } = await params
  let article = getArticle(category, slug)
  let legacyRedirectTo: string | null = null
  if (!article) {
    const move = LEGACY_ARTICLE_MOVES[slug]
    if (move && move.oldCategory === category) {
      const candidate = getArticle(move.newCategory, slug)
      if (candidate) {
        article = candidate
        legacyRedirectTo = `/${move.newCategory}/${slug}/`
      }
    }
  }
  if (!article) notFound()

  if (legacyRedirectTo) {
    const newCatName = CATEGORIES[article.frontmatter.category]?.name || article.frontmatter.categoryName || article.frontmatter.category
    return (
      <div style={{ maxWidth: '680px', margin: '4rem auto', padding: '2rem 1rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔄</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Статья перемещена</h1>
        <p style={{ color: '#555', marginBottom: '1rem' }}>
          Этот материал теперь в разделе <strong>«{newCatName}»</strong>.
        </p>
        <p style={{ marginBottom: '1.5rem' }}>
          <a href={legacyRedirectTo} style={{ color: '#c0392b', fontWeight: 700, textDecoration: 'underline' }}>
            Перейти к актуальной версии статьи →
          </a>
        </p>
        <p style={{ fontSize: '0.85rem', color: '#888' }}>
          Если пришли по старой ссылке — обновите закладку. Новый адрес: <code>{legacyRedirectTo}</code>
        </p>
        <script dangerouslySetInnerHTML={{ __html: `setTimeout(function(){ if (location.pathname !== ${JSON.stringify(legacyRedirectTo)}) location.replace(${JSON.stringify(legacyRedirectTo)}); }, 900);` }} />
      </div>
    )
  }

  const { frontmatter: fm, content, wordCount } = article
  const cat = CATEGORIES[category]
  const color = CATEGORY_COLOR[category] || '#888'
  const emoji = CATEGORY_EMOJI[category] || '📄'
  const url = articleCanonicalUrl(fm)
  const persona = resolvePersona({ author: fm.author, category })
  const authorUrl = `${SITE_URL}/author/${persona.slug}/`
  const imageUrl = articleImageUrl(fm)
  const visibleImageUrl = resolveArticleImage(fm.image, { width: 900, height: 520 })
  const timeToRead = readingTime('x '.repeat(wordCount))

  // F7+F9: all articles needed for ViewTracker slug + tag-based similarity
  const allArticles = getAllArticles()
  const currentArticle = { ...fm, wordCount }
  const similarArticles = getSimilarArticles(allArticles, currentArticle, 4)
  const moreInterestingArticles = getMoreInterestingArticles(
    allArticles,
    currentArticle,
    similarArticles.map((article) => article.slug),
    6,
  )

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    description: fm.description,
    datePublished: fm.date,
    dateModified: fm.updated || fm.date,
    image: [imageUrl],
    thumbnailUrl: imageUrl,
    author: {
      '@type': 'Person',
      name: persona.name,
      url: authorUrl,
      jobTitle: persona.role,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-512.png'), width: 512, height: 512 },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    keywords: fm.tags.join(', '),
    articleSection: cat?.name || fm.categoryName,
    inLanguage: 'ru-RU',
    isAccessibleForFree: true,
    wordCount,
    timeRequired: `PT${Math.max(1, Math.round(wordCount / 180))}M`,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: cat?.name || fm.categoryName, item: `${SITE_URL}/${category}/` },
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
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      datePublished: fm.date,
      image: imageUrl,
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
      image: imageUrl,
      step: steps,
      inLanguage: 'ru-RU',
    }
  }

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
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
                <span style={{
                  display: 'inline-block',
                  backgroundColor: color + '18', color,
                  borderRadius: '4px', padding: '3px 10px',
                  fontSize: '0.78rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {cat?.name || fm.categoryName}
                </span>
                <CategorySubscriptionCta
                  categorySlug={category}
                  categoryName={cat?.name || fm.categoryName}
                  placement="article-header"
                />
              </div>

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
                <ArticleViewCount slug={slug} />
                <span>📝 {wordCount} слов</span>
                {fm.cost && <CostBadge cost={fm.cost} />}
                <FontSizeControl />
                <FavoriteButton slug={slug} title={fm.title} />
              </div>
            </header>

            {/* Compact share right after meta (before image/lead content) */}
            <SharePanel url={url} title={fm.title} variant="compact" />

            {visibleImageUrl && (
              <figure style={{
                position: 'relative',
                aspectRatio: '16 / 9',
                maxHeight: '320px',
                margin: '0 0 1.5rem',
                borderRadius: '10px',
                overflow: 'hidden',
                background: '#f4f0ea',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
              }}>
                <ArticleImage src={visibleImageUrl} alt={fm.title} emoji={emoji} fallbackSize="2.4rem" loading="eager" />
              </figure>
            )}

            {/* Editorial attribution */}
            <ArticlePersonaCard author={fm.author} category={category} updated={fm.updated || fm.date} />

            {/* Fast-answer block — renders only when an answer is available/derivable */}
            <ArticleQuickAnswer fm={fm} />

            <ArticleActionSummary fm={fm} content={content} />

            <div className="toc-inline">
              <TableOfContents content={content} />
              <RelatedArticles articles={similarArticles} compact />
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
              <MDXRemote source={content} components={{ ArticleChecklist, AffiliateLink, h2: ArticleH2, h3: ArticleH3 }} />
            </article>

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

            {/* Star rating */}
            <div style={{ marginTop: '2rem' }}>
              <StarRating slug={slug} />
            </div>

            {/* Helped? + practical result signals + improve textarea (local-safe) */}
            <ArticleFeedback slug={slug} />

            {/* "Покажите, что получилось" — coming-soon, no broken controls */}
            <ArticlePhotoSubmissionCTA fm={fm} />

            {/* Share panel */}
            <SharePanel url={url} title={fm.title} />

            <div style={{ margin: '1.5rem 0 0' }}>
              <CategorySubscriptionCta
                categorySlug={category}
                categoryName={cat?.name || fm.categoryName}
                placement="article-footer"
              />
            </div>

            <MoreArticles articles={moreInterestingArticles} />

            {/* Questions — live Q&A for this article */}
            <ArticleQuestionsBlock articleSlug={slug} />

            <Comments slug={slug} />
          </div>

          {/* Sidebar TOC (desktop only) */}
          <div className="article-sidebar">
            <TableOfContents content={content} sidebar />
            <RelatedArticles articles={similarArticles} compact />
          </div>
        </div>
      </div>
    </>
  )
}
