import { getAllArticles, CATEGORIES } from '@/lib/articles'
import AdminDashboard from '@/components/admin/AdminDashboard'

export default function AdminPage() {
  const articles = getAllArticles()
  return <AdminDashboard articles={articles} categories={CATEGORIES} />
}
