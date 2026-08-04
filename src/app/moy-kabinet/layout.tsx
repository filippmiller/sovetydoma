import type { Metadata } from 'next'
import { canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Личный кабинет — СоветыДома',
  description: 'Личный кабинет читателя СоветыДома.',
  alternates: { canonical: canonicalPath('/moy-kabinet/') },
  robots: { index: false, follow: true },
}

export default function CabinetLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
