'use client'

import { useMemo, useState } from 'react'
import type { ArticleFrontmatter } from '@/lib/articles'
import { searchArticles } from '@/lib/search'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'

interface Props {
  articles: (ArticleFrontmatter & { wordCount: number })[]
}

type SortMode = 'newest' | 'shortest' | 'longest' | 'title'

function uniqueTags(articles: (ArticleFrontmatter & { wordCount: number })[]): string[] {
  const counts = new Map<string, number>()
  for (const article of articles) {
    for (const tag of article.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
    .slice(0, 12)
    .map(([tag]) => tag)
}

function sortArticles(
  articles: (ArticleFrontmatter & { wordCount: number })[],
  sortMode: SortMode,
): (ArticleFrontmatter & { wordCount: number })[] {
  const sorted = [...articles]
  if (sortMode === 'shortest') return sorted.sort((a, b) => a.wordCount - b.wordCount || Date.parse(b.date) - Date.parse(a.date))
  if (sortMode === 'longest') return sorted.sort((a, b) => b.wordCount - a.wordCount || Date.parse(b.date) - Date.parse(a.date))
  if (sortMode === 'title') return sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  return sorted.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

export default function CategoryArticleBrowser({ articles }: Props) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const tags = useMemo(() => uniqueTags(articles), [articles])

  const filtered = useMemo(() => {
    const byTag = tag ? articles.filter((article) => article.tags?.includes(tag)) : articles
    const bySlug = new Map(byTag.map((article) => [article.slug, article]))
    const searched = query.trim()
      ? searchArticles(byTag, query)
        .map((result) => bySlug.get(result.slug))
        .filter((article): article is ArticleFrontmatter & { wordCount: number } => Boolean(article))
      : byTag
    return sortArticles(searched, sortMode)
  }, [articles, query, sortMode, tag])

  return (
    <section aria-label="Подбор статей раздела">
      <div className="category-browser">
        <form role="search" onSubmit={(event) => event.preventDefault()} className="category-browser-search">
          <label>
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти внутри раздела..."
              aria-label="Поиск внутри раздела"
            />
          </label>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Сортировка">
            <option value="newest">Сначала новые</option>
            <option value="shortest">Быстро прочитать</option>
            <option value="longest">Подробные гайды</option>
            <option value="title">По названию</option>
          </select>
        </form>

        {tags.length > 0 && (
          <div className="category-browser-tags" aria-label="Популярные темы раздела">
            <button type="button" className={tag === '' ? 'active' : ''} onClick={() => setTag('')}>
              Все темы
            </button>
            {tags.map((item) => (
              <button key={item} type="button" className={tag === item ? 'active' : ''} onClick={() => setTag(item)}>
                {item}
              </button>
            ))}
          </div>
        )}

        <div className="category-browser-count" aria-live="polite">
          Найдено: {filtered.length} из {articles.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="category-browser-empty">
          Ничего не найдено. Попробуйте убрать тему или сократить запрос.
        </div>
      ) : (
        <ArticleCatalogGrid articles={filtered} />
      )}

      <style jsx>{`
        .category-browser {
          display: grid;
          gap: 0.75rem;
          margin: 0 0 1.25rem;
          padding: 0.85rem;
          border: 1px solid #ebe2db;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .category-browser-search {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(150px, 210px);
          gap: 0.6rem;
        }
        .category-browser-search label {
          position: relative;
          min-width: 0;
        }
        .category-browser-search label span {
          position: absolute;
          left: 0.8rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9a8d85;
          pointer-events: none;
        }
        .category-browser-search input,
        .category-browser-search select {
          width: 100%;
          height: 38px;
          border: 1px solid #ded4cc;
          border-radius: 7px;
          background: #fff;
          color: #222;
          font: inherit;
          font-size: 0.9rem;
          outline: none;
        }
        .category-browser-search input {
          padding: 0 0.8rem 0 2.3rem;
        }
        .category-browser-search select {
          padding: 0 0.65rem;
        }
        .category-browser-search input:focus,
        .category-browser-search select:focus {
          border-color: #c0392b;
          box-shadow: 0 0 0 3px #c0392b14;
        }
        .category-browser-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }
        .category-browser-tags button {
          border: 1px solid #e3d9d1;
          border-radius: 999px;
          background: #faf8f6;
          color: #555;
          font: inherit;
          font-size: 0.8rem;
          font-weight: 700;
          padding: 0.32rem 0.7rem;
          cursor: pointer;
        }
        .category-browser-tags button.active,
        .category-browser-tags button:hover {
          border-color: #c0392b66;
          background: #c0392b12;
          color: #b73226;
        }
        .category-browser-count {
          color: #888;
          font-size: 0.82rem;
        }
        .category-browser-empty {
          border: 1px dashed #dccfc6;
          border-radius: 8px;
          color: #777;
          padding: 1.2rem;
          background: #fff;
        }
        @media (max-width: 680px) {
          .category-browser-search {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
