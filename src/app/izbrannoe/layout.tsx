import type { Metadata } from 'next'
import { canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Избранное — СоветыДома',
  description: 'Сохранённые статьи читателя на СоветыДома.',
  alternates: { canonical: canonicalPath('/izbrannoe/') },
  robots: { index: false, follow: true },
}

export default function FavoritesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
