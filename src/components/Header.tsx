'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import { LIFE_TAXONOMY } from '@/lib/life-taxonomy'
import DarkModeToggle from '@/components/DarkModeToggle'
import HamburgerMenu from '@/components/HamburgerMenu'
import AuthButton from '@/components/auth/AuthButton'

const primaryLinks = [
  { href: '/search/', label: 'Все статьи' },
  { href: '/recepty/', label: 'Рецепты' },
  { href: '/contact/', label: 'Контакты' },
]

export default function Header() {
  const pathname = usePathname()

  const activeCategory = Object.values(CATEGORIES).find(
    (cat) => pathname === `/${cat.slug}` || pathname.startsWith(`/${cat.slug}/`)
  )

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="header-main-row">
          <Link href="/" className="header-logo" aria-label="СоветыДома">
            <span className="header-logo-title">СоветыДома</span>
            <span className="site-tagline" aria-hidden="true">советы для дома</span>
          </Link>

          <details className="header-sections">
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

      <style jsx global>{`
        .site-header {
          background: #fff;
          border-bottom: 1px solid #e8e4df;
          box-shadow: 0 1px 6px rgba(0,0,0,0.07);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .site-header-inner {
          box-sizing: border-box;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.45rem 1rem;
        }
        .header-main-row {
          display: grid;
          grid-template-columns: auto auto minmax(260px, 480px) auto auto;
          align-items: center;
          gap: 0.65rem;
          min-height: 46px;
        }
        .header-logo {
          display: inline-flex;
          align-items: baseline;
          gap: 0.45rem;
          text-decoration: none;
          min-width: max-content;
        }
        .header-logo-title {
          color: #c0392b;
          font-size: 1.35rem;
          font-weight: 800;
          line-height: 1;
        }
        .site-tagline {
          color: #aaa;
          font-size: 0.74rem;
          white-space: nowrap;
        }
        .header-sections {
          position: relative;
          z-index: 120;
        }
        .header-sections summary {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          min-height: 34px;
          padding: 0 0.7rem;
          border: 1px solid #e5dcd5;
          border-radius: 7px;
          background: #faf8f6;
          color: #333;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          list-style: none;
          white-space: nowrap;
        }
        .header-sections summary::-webkit-details-marker {
          display: none;
        }
        .header-sections summary::after {
          content: "▾";
          color: #8c7b72;
          font-size: 0.72rem;
        }
        .header-sections[open] summary {
          border-color: #c0392b55;
          background: #c0392b0d;
          color: #b73226;
        }
        .header-sections-panel {
          position: absolute;
          left: 0;
          top: calc(100% + 0.45rem);
          width: min(920px, calc(100vw - 2rem));
          max-height: min(72vh, 620px);
          overflow: auto;
          background: #fff;
          border: 1px solid #dfd6cf;
          border-radius: 8px;
          box-shadow: 0 18px 42px rgba(0,0,0,0.22);
          padding: 1rem;
        }
        .header-category-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
          padding-bottom: 0.9rem;
          margin-bottom: 0.9rem;
          border-bottom: 1px solid #eee6df;
        }
        .header-category-link {
          display: grid;
          gap: 0.18rem;
          padding: 0.65rem;
          border: 1px solid #eee6df;
          border-radius: 7px;
          color: #222;
          text-decoration: none;
          background: #fff;
        }
        .header-category-link:hover,
        .header-category-link.active {
          border-color: #c0392b55;
          background: #c0392b0d;
        }
        .header-category-link span {
          font-size: 0.88rem;
          font-weight: 800;
        }
        .header-category-link small {
          color: #777;
          font-size: 0.76rem;
          line-height: 1.35;
        }
        .header-taxonomy-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.9rem 1.1rem;
        }
        .header-taxonomy-title {
          display: block;
          color: #222;
          font-size: 0.86rem;
          font-weight: 800;
          margin-bottom: 0.38rem;
          text-decoration: none;
        }
        .header-taxonomy-items {
          display: grid;
          gap: 0.28rem;
        }
        .header-taxonomy-items a {
          color: #666;
          font-size: 0.78rem;
          line-height: 1.3;
          text-decoration: none;
        }
        .header-taxonomy-items a:hover,
        .header-taxonomy-title:hover {
          color: #c0392b;
        }
        .header-search {
          display: grid;
          grid-template-columns: minmax(120px, 1fr) 128px auto;
          align-items: center;
          min-width: 0;
          border: 1px solid #d9d0c8;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
        }
        .header-search label {
          position: relative;
          min-width: 0;
        }
        .header-search label span {
          position: absolute;
          left: 0.7rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94857d;
          font-size: 0.82rem;
          pointer-events: none;
        }
        .header-search input,
        .header-search select {
          width: 100%;
          height: 34px;
          border: 0;
          outline: none;
          background: transparent;
          color: #222;
          font: inherit;
          font-size: 0.84rem;
        }
        .header-search input {
          padding: 0 0.55rem 0 2rem;
        }
        .header-search select {
          border-left: 1px solid #eee6df;
          padding: 0 0.45rem;
        }
        .header-search button {
          height: 34px;
          border: 0;
          background: #c0392b;
          color: #fff;
          font: inherit;
          font-size: 0.82rem;
          font-weight: 800;
          padding: 0 0.8rem;
          cursor: pointer;
        }
        .header-search button:hover {
          background: #a93226;
        }
        .header-quick-links {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          white-space: nowrap;
        }
        .header-quick-links a {
          color: #444;
          font-size: 0.84rem;
          font-weight: 700;
          text-decoration: none;
        }
        .header-quick-links a:hover,
        .header-quick-links a.active {
          color: #c0392b;
        }
        .header-actions {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          justify-content: flex-end;
          white-space: nowrap;
        }
        .header-search-link,
        .header-icon-link {
          display: none;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 32px;
          color: #c0392b;
          text-decoration: none;
          line-height: 1;
        }
        .header-rss {
          display: inline-flex;
          align-items: center;
          height: 30px;
          padding: 0 0.55rem;
          border: 1px solid #e67e2233;
          border-radius: 6px;
          background: #e67e220a;
          color: #d66d18;
          font-size: 0.72rem;
          font-weight: 800;
          text-decoration: none;
        }
        @media (max-width: 1100px) {
          .header-main-row {
            grid-template-columns: auto auto minmax(220px, 1fr) auto;
          }
          .header-quick-links {
            display: none;
          }
        }
        @media (max-width: 820px) {
          .site-header-inner {
            padding: 0.45rem 0.75rem;
          }
          .header-main-row {
            grid-template-columns: auto auto 1fr;
            gap: 0.45rem;
          }
          .header-search {
            display: none;
          }
          .header-search-link,
          .header-icon-link {
            display: inline-flex;
          }
          .header-actions {
            grid-column: 3;
          }
          .header-logo-title {
            font-size: 1.22rem;
          }
          .site-tagline,
          .header-rss {
            display: none;
          }
          .header-sections-panel {
            left: auto;
            right: -8.5rem;
            width: min(92vw, 520px);
          }
          .header-category-grid,
          .header-taxonomy-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 520px) {
          .header-main-row {
            grid-template-columns: 1fr auto;
          }
          .header-sections {
            order: 3;
            grid-column: 1 / -1;
          }
          .header-sections summary {
            width: 100%;
            justify-content: space-between;
          }
          .header-sections-panel {
            left: 0;
            right: auto;
            width: calc(100vw - 1.5rem);
          }
          .header-actions {
            grid-column: 2;
            gap: 0.3rem;
            min-width: 0;
          }
          .header-icon-link {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}
