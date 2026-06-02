'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import SubscriptionPanel from '@/components/subscriptions/SubscriptionPanel'
import { CATEGORIES } from '@/lib/categories'

function resolveCategorySlugFromPath(pathname: string | null) {
  if (!pathname) return null
  const [firstSegment] = pathname.split('/').filter(Boolean)
  if (firstSegment && CATEGORIES[firstSegment]) return firstSegment
  return null
}

export default function NewsletterForm() {
  const pathname = usePathname()
  const categorySlug = useMemo(() => resolveCategorySlugFromPath(pathname), [pathname])

  return (
    <SubscriptionPanel
      compact
      tone="dark"
      showHeading={false}
      initialCategorySlug={categorySlug ?? undefined}
    />
  )
}
