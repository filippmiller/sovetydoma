'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const primaryLinks = [
  { href: '/search/', label: 'Все статьи' },
  { href: '/recepty/', label: 'Рецепты' },
  { href: '/contact/', label: 'Контакты' },
]

/**
 * Quick links with active-route highlighting. Client island so the Header
 * shell can stay a server component (only the active class needs usePathname).
 */
export default function HeaderQuickLinks() {
  const pathname = usePathname()
  return (
    <nav className="header-quick-links" aria-label="Быстрые ссылки">
      {primaryLinks.map((link) => {
        const isActive = pathname === link.href || pathname === link.href.replace(/\/$/, '')
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? 'active' : undefined}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
