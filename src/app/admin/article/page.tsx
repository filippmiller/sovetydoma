import { Suspense } from 'react'
import AdminArticleEditor from '@/components/admin/AdminArticleEditor'

// Static-export-compatible detail route (bead sovetydoma-11g.3): the article id
// arrives via query param (/admin/article/?id=<uuid>) because a static export
// cannot prerender unknown dynamic segments. useSearchParams requires Suspense.
export default function AdminArticlePage() {
  return (
    <Suspense fallback={null}>
      <AdminArticleEditor />
    </Suspense>
  )
}
