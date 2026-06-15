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

export function buildFaqSchema(content: string): object | null {
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
  return faqEntities.length >= 2
    ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqEntities }
    : null
}

export function buildAdditionalSchema(
  fm: ArticleFrontmatter,
  imageUrl: string,
  content: string,
): object | null {
  if (fm.schemaType === 'Recipe') {
    return {
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
    return {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: fm.title,
      description: fm.description,
      image: imageUrl,
      step: steps,
      inLanguage: 'ru-RU',
    }
  }
  return null
}
