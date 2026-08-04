'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES, getSubcategoriesFor } from '@/lib/categories'

const CATEGORY_EMOJI: Record<string, string> = {
  'dacha-i-ogorod': '🌱', 'dom-i-uborka': '🏠', 'ekonomiya': '💰',
  'krasota-i-uhod': '💅', 'kulinaria': '🍳', 'layfkhaki': '💡',
  'otdyh-i-puteshestviya': '✈️', 'pokupki-i-tehnika': '🛒',
  'rybalka': '🎣', 'semya-i-deti': '👨‍👩‍👧', 'zdorovie-i-bezopasnost': '🏥',
  'zdorovoe-pitanie': '🥗',
}

const topLinks = [
  { href: '/', label: 'Лента', icon: '⌂', home: true },
  { href: '/articles/', label: 'Все статьи', icon: '▦' },
  { href: '/search/', label: 'Поиск', icon: '⌕' },
]

const myLinks = [
  { href: '/izbrannoe/', label: 'Избранное', icon: '♡' },
  { href: '/moy-kabinet/', label: 'Кабинет', icon: '◉' },
  { href: '/podpiski/', label: 'Подписки', icon: '✉' },
]

export default function FeedLeftNav() {
  const pathname = usePathname() || '/'
  const currentPath = pathname.replace(/\/$/, '') || '/'
  const [openCat, setOpenCat] = useState<string | null>(null)

  const toggleCategory = useCallback((slug: string) => {
    setOpenCat((prev) => (prev === slug ? null : slug))
  }, [])

  const isActive = (href: string) => {
    const p = href.split('#', 1)[0].replace(/\/$/, '') || '/'
    return currentPath === p || currentPath.startsWith(`${p}/`)
  }

  const catSlugs = Object.keys(CATEGORIES)

  return (
    <nav className="feed-left-nav" aria-label="Разделы СоветыДома">
      {/* Brand */}
      <div className="feed-left-nav-brand">
        <span aria-hidden="true">✦</span>
        <div>
          <strong>СоветыДома</strong>
          <small>советы для дома</small>
        </div>
      </div>

      {/* Top links */}
      <div className="feed-left-nav-group">
        {topLinks.map((item) => {
          const active = item.home ? currentPath === '/' : isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`feed-left-nav-item${active ? ' active' : ''}`}
            >
              <span aria-hidden="true" className="feed-left-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Categories accordion */}
      <div className="feed-left-nav-cats">
        <h2 className="feed-left-nav-title">Разделы</h2>
        {catSlugs.map((slug) => {
          const cat = CATEGORIES[slug]
          const emoji = CATEGORY_EMOJI[slug] || '📄'
          const isOpen = openCat === slug
          const subs = getSubcategoriesFor(slug)
          const catActive = currentPath === `/${slug}` || currentPath.startsWith(`/${slug}/`)

          return (
            <div key={slug} className={`feed-left-nav-cat${isOpen ? ' open' : ''}${catActive ? ' active' : ''}`}>
              <button
                type="button"
                className="feed-left-nav-cat-btn"
                onClick={() => toggleCategory(slug)}
                aria-expanded={isOpen}
              >
                <span aria-hidden="true" className="feed-left-nav-icon">{emoji}</span>
                <span className="feed-left-nav-cat-label">{cat.name}</span>
                <span className="feed-left-nav-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && subs.length > 0 && (
                <div className="feed-left-nav-subs">
                  {subs.map((sub) => (
                    <Link
                      key={sub.slug}
                      href={`/${slug}/#${sub.slug}`}
                      className="feed-left-nav-sub-link"
                    >
                      {sub.name}
                    </Link>
                  ))}
                  <Link href={`/${slug}/`} className="feed-left-nav-sub-link feed-left-nav-sub-all">
                    Все статьи раздела →
                  </Link>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* My section */}
      <div className="feed-left-nav-group">
        <h2 className="feed-left-nav-title">Моё</h2>
        {myLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={`feed-left-nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span aria-hidden="true" className="feed-left-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Subscribe CTA */}
      <Link href="/podpiski/" className="feed-left-nav-plan">
        <span className="feed-left-nav-plan-icon" aria-hidden="true">✉</span>
        <span>
          <strong>Подпишитесь</strong>
          <small>новые советы каждую неделю</small>
        </span>
        <b aria-hidden="true">→</b>
      </Link>
    </nav>
  )
}
