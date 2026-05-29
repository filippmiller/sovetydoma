import { getAllSlugs, getArticle, getAllArticles } from '@/lib/articles'
import AdminArticleDetail from '@/components/admin/AdminArticleDetail'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  // We only have slug in the URL, but getArticle needs category too.
  // Build a slug→category map from all articles.
  return getAllSlugs().map(({ slug }) => ({ slug }))
}

export default async function AdminArticlePage({ params }: Props) {
  const { slug } = await params

  // Find the article across all categories
  const all = getAllArticles()
  const meta = all.find(a => a.slug === slug)
  if (!meta) notFound()

  const article = getArticle(meta.category, slug)
  if (!article) notFound()

  return <AdminArticleDetail article={article} />
}
