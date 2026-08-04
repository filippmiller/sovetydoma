import { redirect } from 'next/navigation'

/**
 * Legacy category alias retained for existing links. The canonical category
 * is now `kulinaria`; redirecting there preserves the full category shell,
 * including the left accordion and its subcategory filters.
 */
export default function LegacyHealthyEatingPage() {
  redirect('/kulinaria/')
}
