'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import { LIFE_TAXONOMY } from '@/lib/life-taxonomy'

/**
 * The "Разделы" mega-menu. Split out as a client island so the surrounding
 * Header can stay a server component — only this piece needs usePathname
 * (active-category highlight) and the close-on-navigation effect.
 */
export default function HeaderMegaMenu() {
  const pathname = usePathname()
  const sectionsRef = useRef<HTMLDetailsElement>(null)

  // Close the sections mega-menu after a client-side navigation — the native
  // <details> would otherwise stay open on top of the freshly rendered page.
  useEffect(() => {
    if (sectionsRef.current) sectionsRef.current.open = false
  }, [pathname])

  const activeCategory = Object.values(CATEGORIES).find(
    (cat) => pathname === `/${cat.slug}` || pathname.startsWith(`/${cat.slug}/`)
  )

  return (
    <details className="header-sections" ref={sectionsRef}>
      <summary aria-label="Открыть разделы">
        <span>{activeCategory?.name || 'Разделы'}</span>
      </summary>
      <div className="header-sections-panel">
        <div className="header-category-grid">
          {Object.values(CATEGORIES).map((cat) => {
            const isActive = cat.slug === activeCategory?.slug
            return (
              <Link
                key={cat.slug}
                href={`/${cat.slug}/`}
                aria-current={isActive ? 'page' : undefined}
                className={isActive ? 'header-category-link active' : 'header-category-link'}
              >
                <span>{cat.name}</span>
                <small>{cat.description}</small>
              </Link>
            )
          })}
        </div>

        <div className="header-taxonomy-grid" aria-label="Темы">
          {LIFE_TAXONOMY.slice(0, 9).map((group) => (
            <section key={group.title}>
              {group.route ? (
                <Link href={group.route} className="header-taxonomy-title">{group.title}</Link>
              ) : (
                <div className="header-taxonomy-title">{group.title}</div>
              )}
              <div className="header-taxonomy-items">
                {group.items.slice(0, 4).map((item) => (
                  <Link key={item} href={`/search/?q=${encodeURIComponent(item)}`}>
                    {item}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </details>
  )
}
