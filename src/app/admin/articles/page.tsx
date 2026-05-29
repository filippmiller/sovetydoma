import { getAllArticles } from '@/lib/articles'
import AdminArticlesList from '@/components/admin/AdminArticlesList'

export default function AdminArticlesPage() {
  const articles = getAllArticles()
  return <AdminArticlesList articles={articles} />
}
