import Link from 'next/link'
import { CATEGORIES } from '@/lib/articles'

export default function Header() {
  return (
    <header style={{ backgroundColor: '#fff', borderBottom: '1px solid #e8e4df' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        {/* Logo row */}
        <div style={{ padding: '1rem 0 0.5rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#c0392b',
              letterSpacing: '-0.5px',
            }}>
              СоветыДома
            </span>
            <span style={{ fontSize: '0.85rem', color: '#888', marginLeft: '0.5rem' }}>
              — полезно и по-домашнему
            </span>
          </Link>
        </div>

        {/* Category nav */}
        <nav style={{ display: 'flex', gap: '0', overflowX: 'auto', paddingBottom: '0' }}>
          {Object.values(CATEGORIES).map((cat) => (
            <Link
              key={cat.slug}
              href={`/${cat.slug}`}
              style={{
                display: 'inline-block',
                padding: '0.6rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 500,
                color: '#444',
                textDecoration: 'none',
                borderBottom: '3px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'color 0.2s',
              }}
              className="nav-link"
            >
              {cat.name}
            </Link>
          ))}
        </nav>
      </div>

      <style>{`
        .nav-link:hover {
          color: #c0392b !important;
          border-bottom-color: #c0392b !important;
        }
      `}</style>
    </header>
  )
}
