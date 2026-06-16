import type { ArticleFrontmatter } from '@/lib/articles'
import type { Persona } from '@/lib/personas'
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/seo'

interface CategoryInfo {
  name: string
}

export function buildArticleJsonLd(
  fm: ArticleFrontmatter,
  url: string,
  imageUrl: string,
  jsonLdImageDims: { width: number; height: number },
  cat: CategoryInfo | undefined,
  persona: Persona,
  authorUrl: string,
  wordCount: number,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': ['Article', 'NewsArticle'],
    headline: fm.title,
    description: fm.description,
    url,
    datePublished: fm.date,
    dateModified: fm.updated || fm.date,
    image: [{ '@type': 'ImageObject', url: imageUrl, ...jsonLdImageDims }],
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
}

export function buildBreadcrumbJsonLd(
  category: string,
  cat: CategoryInfo | undefined,
  fm: ArticleFrontmatter,
  url: string,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Главная', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: cat?.name || fm.categoryName, item: `${SITE_URL}/${category}/` },
      { '@type': 'ListItem', position: 3, name: fm.title, item: url },
    ],
  }
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*`>_~]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function extractAnswerText(content: string, startLine: number): string {
  const lines = content.split('\n')
  const bodyLines: string[] = []
  for (let j = startLine + 1; j < lines.length; j++) {
    if (/^#{1,6} /.test(lines[j])) break
    bodyLines.push(lines[j])
  }
  return bodyLines
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => stripMarkdownInline(p))
    .filter((p) => p.length > 0)
    .join(' ')
}

export function buildFaqSchema(content: string): object | null {
  const faqEntities: { '@type': string; name: string; acceptedAnswer: { '@type': string; text: string } }[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#{2,3} (.+)$/)
    if (!match) continue
    const headingText = match[1].trim()
    if (!headingText.endsWith('?')) continue
    const answerText = extractAnswerText(content, i)
    if (answerText) {
      faqEntities.push({
        '@type': 'Question',
        name: headingText,
        acceptedAnswer: { '@type': 'Answer', text: answerText },
      })
    }
  }
  return faqEntities.length >= 2
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqEntities }
    : null
}

function looksLikeInstructional(content: string): boolean {
  const h2s = [...content.matchAll(/^## (.+)$/gm)]
  if (h2s.length >= 3) return true
  const numbered = [...content.matchAll(/^## \d+[\.)]?\s+/gm)]
  if (numbered.length >= 2) return true
  return false
}

function buildHowToSteps(content: string, recipeSteps?: string[]): Array<{ '@type': string; position: number; name: string; text?: string }> {
  if (recipeSteps && recipeSteps.length > 0) {
    return recipeSteps.map((step, i) => ({ '@type': 'HowToStep', position: i + 1, name: step.trim() }))
  }
  const headings = [...content.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
  if (headings.length === 0) return []
  return headings.map((name, i) => ({ '@type': 'HowToStep', position: i + 1, name }))
}

function isoDurationFromHuman(time?: string): string | undefined {
  if (!time) return undefined
  const minutes = /(\d+)\s*мин/i.exec(time)
  const hours = /(\d+)\s*ч/i.exec(time)
  if (!minutes && !hours) return undefined
  let iso = 'PT'
  if (hours) iso += `${hours[1]}H`
  if (minutes) iso += `${minutes[1]}M`
  return iso
}

export function buildAdditionalSchema(
  fm: ArticleFrontmatter,
  imageUrl: string,
  content: string,
): object | object[] | null {
  const schemas: object[] = []

  if (fm.schemaType === 'Recipe') {
    const instructions =
      fm.recipeSteps && fm.recipeSteps.length > 0
        ? fm.recipeSteps.map((step, i) => ({ '@type': 'HowToStep', position: i + 1, name: step.trim() }))
        : buildHowToSteps(content)
    schemas.push({
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
      recipeInstructions: instructions,
      keywords: fm.tags.join(', '),
      inLanguage: 'ru-RU',
    })
  }

  const howToSteps = buildHowToSteps(content, fm.recipeSteps)
  if (fm.schemaType === 'HowTo' || (howToSteps.length >= 3 && looksLikeInstructional(content))) {
    const totalTime = isoDurationFromHuman(fm.time)
    const howTo: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: fm.title,
      description: fm.description,
      image: imageUrl,
      step: howToSteps,
      inLanguage: 'ru-RU',
    }
    if (totalTime) howTo.totalTime = totalTime
    schemas.push(howTo)
  }

  const faq = buildFaqSchema(content)
  if (faq) schemas.push(faq)

  return schemas.length ? schemas : null
}
