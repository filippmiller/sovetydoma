import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'
import DarkModeToggle from '@/components/DarkModeToggle'
import HamburgerMenu from '@/components/HamburgerMenu'
import AuthButton from '@/components/auth/AuthButton'
import HeaderMegaMenu from '@/components/HeaderMegaMenu'
import HeaderQuickLinks from '@/components/HeaderQuickLinks'

/**
 * Server component. The two route-aware pieces (mega-menu active state +
 * close-on-nav, and quick-link active state) are isolated in the HeaderMegaMenu
 * and HeaderQuickLinks client islands, so the rest of the header — logo, search
 * form, action icons — renders on the server with no client JS. Styles live in
 * globals.css (previously a styled-jsx block that forced 'use client').
 */
export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="header-main-row">
          <Link href="/" className="header-logo" aria-label="СоветыДома">
            <span className="header-logo-title">СоветыДома</span>
            <span className="site-tagline" aria-hidden="true">советы для дома</span>
          </Link>

          <HeaderMegaMenu />

          <form className="header-search" action="/search/" method="get" role="search">
            <label>
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                name="q"
                placeholder="Найти совет..."
                aria-label="Поиск по статьям"
              />
            </label>
            <select name="category" aria-label="Раздел поиска" defaultValue="">
              <option value="">Все разделы</option>
              {Object.values(CATEGORIES).map((cat) => (
                <option key={cat.slug} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
            <button type="submit">Найти</button>
          </form>

          <HeaderQuickLinks />

          <div className="header-actions">
            <Link href="/search/" className="header-search-link" aria-label="Поиск" title="Поиск">🔍</Link>
            <Link href="/izbrannoe/" aria-label="Избранное" title="Избранное" className="header-icon-link">❤</Link>
            <AuthButton />
            <DarkModeToggle />
            <HamburgerMenu />
            <Link href="/feed.xml" title="RSS-лента" className="header-rss">RSS</Link>
          </div>
        </div>
      </div>
    </header>
  )
}
