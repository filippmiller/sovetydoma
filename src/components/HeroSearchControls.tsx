'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { searchArticles, type SearchableArticle } from '@/lib/search'
import { LIFE_TAXONOMY } from '@/lib/life-taxonomy'

interface CategoryOption {
  slug: string
  name: string
  count: number
}

interface Props {
  articles: SearchableArticle[]
  categories: CategoryOption[]
}

export default function HeroSearchControls({ articles, categories }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const filteredArticles = useMemo(() => {
    return category ? articles.filter((article) => article.category === category) : articles
  }, [articles, category])

  const suggestions = useMemo(() => {
    if (query.trim().length < 3) return []
    return searchArticles(filteredArticles, query, 5)
  }, [filteredArticles, query])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!query.trim() && category) {
      event.preventDefault()
      window.location.href = `/${category}/`
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div className="hero-search-shell">
        <details className="hero-taxonomy-details">
          <summary aria-label="Открыть все категории">
            <span>Категории</span>
          </summary>
          <div className="hero-taxonomy-panel">
            {LIFE_TAXONOMY.map((group) => (
              <section key={group.title} className="hero-taxonomy-group">
                {group.route ? (
                  <Link href={group.route} className="hero-taxonomy-title">{group.title}</Link>
                ) : (
                  <div className="hero-taxonomy-title">{group.title}</div>
                )}
                <div className="hero-taxonomy-items">
                  {group.items.slice(0, 6).map((item) => (
                    <Link key={item} href={`/search/?q=${encodeURIComponent(item)}`}>
                      {item}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </details>
        <form
          className="hero-search-form"
          action="/search/"
          method="get"
          role="search"
          onSubmit={onSubmit}
        >
          <label className="hero-search-input-label">
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти совет: одуванчики, щука, вытяжка..."
              aria-label="Поиск по статьям"
            />
          </label>
          <label className="hero-category-select-label">
            <span className="sr-only">Раздел</span>
            <select
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Выбрать раздел"
            >
              <option value="">Все разделы</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name} ({cat.count})
                </option>
              ))}
            </select>
          </label>
          <button className="hero-search-submit" type="submit">
            Искать
          </button>
        </form>
      </div>
      <style>{`
        .hero-search-shell {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.45rem;
          align-items: stretch;
          width: 100%;
          position: relative;
        }
        @media (max-width: 720px) {
          .hero-search-shell {
            grid-template-columns: 1fr !important;
          }
          .hero-search-form {
            grid-template-columns: 1fr !important;
          }
          .hero-search-submit {
            width: 100%;
          }
          .hero-taxonomy-panel {
            left: 0 !important;
            right: 0 !important;
            width: auto !important;
            grid-template-columns: 1fr !important;
          }
        }
        .hero-search-form {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(150px, 220px) auto;
          gap: 0.45rem;
          align-items: stretch;
          width: 100%;
        }
        .hero-search-input-label {
          position: relative;
          min-width: 0;
        }
        .hero-search-input-label span {
          position: absolute;
          left: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9b8d86;
          font-size: 0.95rem;
          pointer-events: none;
        }
        .hero-search-input-label input,
        .hero-category-select-label select {
          width: 100%;
          min-height: 42px;
          border: 1px solid rgba(255,255,255,0.55);
          border-radius: 7px;
          background: #fff;
          color: #1f1f1f;
          font: inherit;
          font-size: 0.92rem;
          outline: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.16);
        }
        .hero-search-input-label input {
          padding: 0.6rem 0.85rem 0.6rem 2.25rem;
        }
        .hero-category-select-label select {
          padding: 0.55rem 0.7rem;
        }
        .hero-search-submit,
        .hero-taxonomy-details summary {
          min-height: 42px;
          border: none;
          border-radius: 7px;
          background: #fff;
          color: #b73226;
          padding: 0 0.95rem;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
          white-space: nowrap;
        }
        .hero-taxonomy-details summary {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          list-style: none;
          height: 100%;
        }
        .hero-taxonomy-details summary::-webkit-details-marker {
          display: none;
        }
        .hero-taxonomy-details summary::after {
          content: '▾';
          font-size: 0.8rem;
        }
        .hero-taxonomy-details[open] summary::after {
          content: '▴';
        }
        .hero-taxonomy-panel {
          position: absolute;
          z-index: 6;
          left: 0;
          top: calc(100% + 0.55rem);
          width: min(960px, calc(100vw - 2rem));
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem 1.2rem;
          background: #fff;
          color: #222;
          border: 1px solid #e2d8d0;
          border-radius: 10px;
          padding: 1.1rem;
          box-shadow: 0 18px 40px rgba(0,0,0,0.26);
        }
        .hero-taxonomy-title {
          display: block;
          color: #222;
          font-weight: 800;
          font-size: 0.9rem;
          text-decoration: none;
          margin-bottom: 0.45rem;
        }
        .hero-taxonomy-items {
          display: grid;
          gap: 0.35rem;
        }
        .hero-taxonomy-items a {
          color: #666;
          text-decoration: none;
          font-size: 0.82rem;
          line-height: 1.3;
        }
        .hero-taxonomy-items a:hover,
        .hero-taxonomy-title:hover {
          color: #c0392b;
        }
      `}</style>

      {suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            zIndex: 4,
            left: 0,
            right: 0,
            top: 'calc(100% + 0.45rem)',
            border: '1px solid #e7ded6',
            borderRadius: '8px',
            background: '#fff',
            overflow: 'hidden',
            boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
          }}
        >
          {suggestions.map((article) => (
            <Link
              key={article.slug}
              href={`/${article.category}/${article.slug}/`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: '0.75rem',
                padding: '0.68rem 0.85rem',
                color: 'inherit',
                textDecoration: 'none',
                borderBottom: '1px solid #f0ebe6',
                alignItems: 'center',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: '#222', fontWeight: 800, lineHeight: 1.35 }}>
                  {article.title}
                </span>
                <span
                  style={{
                    display: 'block',
                    color: '#777',
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {article.description}
                </span>
              </span>
              <span
                style={{
                  color: '#a4382d',
                  background: '#c0392b12',
                  border: '1px solid #c0392b30',
                  borderRadius: '999px',
                  padding: '0.16rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}
              >
                {article.categoryName}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
