'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'

export default function Header() {
  const pathname = usePathname()

  return (
    <header style={{
      backgroundColor: '#fff',
      borderBottom: '1px solid #e8e4df',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        {/* Logo row */}
        <div style={{ padding: '0.75rem 0 0.4rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#c0392b', letterSpacing: '-0.5px' }}>
              СоветыДома
            </span>
          </Link>
          <span style={{ fontSize: '0.82rem', color: '#aaa', display: 'none' }} className="tagline">
            — полезно и по-домашнему
          </span>
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
                  display: 'inline-block',
                  padding: '0.55rem 0.9rem',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#c0392b' : '#444',
                  textDecoration: 'none',
                  borderBottom: `3px solid ${isActive ? '#c0392b' : 'transparent'}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.name}
              </Link>
            )
          })}
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
