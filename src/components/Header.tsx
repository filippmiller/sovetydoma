'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import DarkModeToggle from '@/components/DarkModeToggle'

export default function Header() {
  const pathname = usePathname()

  return (
    <header style={{
      backgroundColor: '#fff',
      borderBottom: '1px solid #e8e4df',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        {/* Logo row */}
        <div style={{ padding: '0.7rem 0 0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', minHeight: '52px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexShrink: 0 }}>
            <span style={{ fontSize: '1.55rem', fontWeight: 800, color: '#c0392b', letterSpacing: '-0.5px', lineHeight: 1 }}>
              СоветыДома
            </span>
            <span className="site-tagline" style={{ fontSize: '0.8rem', color: '#bbb', display: 'inline' }} aria-hidden="true">
              — советы для дома
            </span>
          </Link>
          {/* Right side controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <DarkModeToggle />
            <Link
              href="/feed.xml"
              title="РСС-лента"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                color: '#e67e22', fontSize: '0.75rem', fontWeight: 700,
                textDecoration: 'none', padding: '3px 8px', borderRadius: '5px',
                border: '1.5px solid #e67e2233', backgroundColor: '#e67e220a',
                flexShrink: 0,
              }}
            >
              📡 RSS
            </Link>
          </div>
        </div>

        {/* Category nav */}
        <nav aria-label="Основная навигация" style={{
          display: 'flex',
          gap: '0',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {Object.values(CATEGORIES).map((cat) => {
            const isActive = pathname === `/${cat.slug}` || pathname.startsWith(`/${cat.slug}/`)
            return (
              <Link
                key={cat.slug}
                href={`/${cat.slug}`}
                aria-current={isActive ? 'page' : undefined}
                className={`nav-link${isActive ? ' nav-link-active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.55rem 0.85rem',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#c0392b' : '#444',
                  textDecoration: 'none',
                  borderBottom: `3px solid ${isActive ? '#c0392b' : 'transparent'}`,
                  whiteSpace: 'nowrap',
                  minHeight: '44px',
                }}
              >
                {cat.name}
              </Link>
            )
          })}

          {/* F10: Recipes page link */}
          <Link
            href="/recepty"
            className={`nav-link${pathname === '/recepty' ? ' nav-link-active' : ''}`}
            aria-current={pathname === '/recepty' ? 'page' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.55rem 0.85rem',
              fontSize: '0.88rem',
              fontWeight: pathname === '/recepty' ? 700 : 500,
              color: pathname === '/recepty' ? '#c0392b' : '#444',
              textDecoration: 'none',
              borderBottom: `3px solid ${pathname === '/recepty' ? '#c0392b' : 'transparent'}`,
              whiteSpace: 'nowrap',
              minHeight: '44px',
            }}
          >
            🍳 Рецепты
          </Link>

          {/* Search */}
          <Link
            href="/search"
            className="nav-link"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.55rem 0.9rem',
              fontSize: '0.88rem',
              fontWeight: 500,
              color: '#888',
              textDecoration: 'none',
              borderBottom: '3px solid transparent',
              whiteSpace: 'nowrap',
              marginLeft: 'auto',
              minHeight: '44px',
            }}
            title="Поиск"
          >
            🔍
          </Link>
        </nav>
      </div>
    </header>
  )
}
