import AdminArticlesList from '@/components/admin/AdminArticlesList'

// Runtime article manager (bead sovetydoma-11g.3): the list is fetched from the
// sovetydoma-admin-api worker at runtime — all ~2.5k content_matrix rows, not
// just the build-time MDX corpus.
export default function AdminArticlesPage() {
  return <AdminArticlesList />
}
