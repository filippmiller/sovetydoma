import { getAllArticles } from '@/lib/articles'
import SearchClient from '@/components/SearchClient'
import type { Metadata } from 'next'
import { canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Поиск по сайту — СоветыДома',
  description: 'Найдите нужную статью на СоветыДома — поиск по рубрикам и тегам',
  alternates: { canonical: canonicalPath('/search/') },
  robots: { index: false },
}

export default function SearchPage() {
  const articles = getAllArticles().map((a) => ({
    title: a.title,
    description: a.description,
    tags: a.tags,
    category: a.category,
    categoryName: a.categoryName,
    slug: a.slug,
    date: a.date,
    wordCount: a.wordCount,
  }))

  return <SearchClient articles={articles} />
}
