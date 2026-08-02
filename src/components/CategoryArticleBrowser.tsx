'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ArticleFrontmatter } from '@/lib/articles'
import { CATEGORIES } from '@/lib/categories'
import { searchArticles } from '@/lib/search'
import ArticleCatalogGrid from '@/components/ArticleCatalogGrid'
import ArticleCard from '@/components/ArticleCard'
import { matchesDifficulty, matchesTime, matchesCost } from '@/lib/article-filters.mjs'
import { themesForCategory } from '@/lib/categoryThemes'
import { limitConsecutiveTopics } from '@/lib/feedDiversity'
import { isRecentArticle } from '@/lib/utils'

type CategoryArticle = ArticleFrontmatter & { wordCount: number }

interface Props {
  category: string
  articles: CategoryArticle[]
}

type SortMode = 'newest' | 'shortest' | 'longest' | 'title'

// Render in windows so a 179-article category doesn't ship 179 cards and a
// 179-slug Supabase stats query on first paint.
const PAGE_SIZE = 24
const DYNAMIC_FETCH_LIMIT = 60
const HERO_RECENCY_DAYS = 3
const RENDERER_API_URL = 'https://sovetydoma-renderer.filippmiller.workers.dev'

interface DynamicRow {
  slug: string
  category: string
  title: string
  description: string | null
  tags: string[] | null
  publishedAt: string
}

// The static category page (src/app/[category]/page.tsx) only ever sees the
// .mdx corpus baked in at the last full rebuild — a dynamically-published
// article (see docs/NO-REDEPLOY-PUBLISHING.md) is already live on its own URL
// and on the homepage, but invisible here until the next rebuild. This fetches
// the same narrow read-only feed the homepage's "Новое" widget uses, scoped to
// this category, and folds it in so "Сначала новые" and the search box are
// not silently lying about what's actually published.
function mapDynamicRow(row: DynamicRow): CategoryArticle {
  return {
    title: row.title,
    slug: row.slug,
    category: row.category,
    categoryName: CATEGORIES[row.category]?.name || row.category,
    description: row.description || '',
    date: row.publishedAt,
    image: '',
    tags: row.tags || [],
    wordCount: 0,
  }
}

function uniqueTags(articles: CategoryArticle[]): string[] {
  const counts = new Map<string, number>()
  for (const article of articles) {
    for (const tag of article.tags || []) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
    .slice(0, 12)
    .map(([tag]) => tag)
}

function sortArticles(articles: CategoryArticle[], sortMode: SortMode): CategoryArticle[] {
  const sorted = [...articles]
  if (sortMode === 'shortest') return sorted.sort((a, b) => a.wordCount - b.wordCount || Date.parse(b.date) - Date.parse(a.date))
  if (sortMode === 'longest') return sorted.sort((a, b) => b.wordCount - a.wordCount || Date.parse(b.date) - Date.parse(a.date))
  if (sortMode === 'title') return sorted.sort((a, b) => a.title.localeCompare(b.title, 'ru'))
  return sorted.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

export default function CategoryArticleBrowser({ category, articles: staticArticles }: Props) {
  const [dynamicArticles, setDynamicArticles] = useState<CategoryArticle[]>([])

  useEffect(() => {
    let active = true
    fetch(`${RENDERER_API_URL}/api/category-latest.json?category=${category}&limit=${DYNAMIC_FETCH_LIMIT}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: DynamicRow[]) => {
        if (active && Array.isArray(rows)) setDynamicArticles(rows.map(mapDynamicRow))
      })
      .catch(() => {})
    return () => { active = false }
  }, [category])

  const allArticles = useMemo(() => {
    const staticSlugs = new Set(staticArticles.map((a) => a.slug))
    const freshOnly = dynamicArticles.filter((a) => !staticSlugs.has(a.slug))
    return [...staticArticles, ...freshOnly]
  }, [staticArticles, dynamicArticles])

  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [difficulty, setDifficulty] = useState('')
  const [timeFilter, setTimeFilter] = useState('')
  const [costFilter, setCostFilter] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const themes = useMemo(() => themesForCategory(category, allArticles), [category, allArticles])
  const usingThemes = themes.length > 0
  const tags = useMemo(() => uniqueTags(allArticles), [allArticles])
  const topicOptions = usingThemes ? themes.map((t) => t.label) : tags

  const topicMatch = useMemo(() => {
    if (!topic) return null
    if (usingThemes) {
      const found = themes.find((t) => t.label === topic)
      return found ? new Set(found.articles.map((a) => a.slug)) : new Set<string>()
    }
    return null
  }, [topic, usingThemes, themes])

  const activeFilterCount = [difficulty, timeFilter, costFilter].filter(Boolean).length
  const isCleanState = !query.trim() && !topic && activeFilterCount === 0 && sortMode === 'newest'

  const filteredBase = useMemo(() => {
    const byTopic = !topic
      ? allArticles
      : usingThemes
        ? allArticles.filter((a) => topicMatch?.has(a.slug))
        : allArticles.filter((a) => a.tags?.includes(topic))
    const byFilters = byTopic.filter(
      (article) =>
        matchesDifficulty(article, difficulty) &&
        matchesTime(article, timeFilter) &&
        matchesCost(article, costFilter),
    )
    const bySlug = new Map(byFilters.map((article) => [article.slug, article]))
    const searched = query.trim()
      ? searchArticles(byFilters, query)
        .map((result) => bySlug.get(result.slug))
        .filter((article): article is CategoryArticle => Boolean(article))
      : byFilters
    return sortArticles(searched, sortMode)
  }, [allArticles, query, sortMode, topic, topicMatch, usingThemes, difficulty, timeFilter, costFilter])

  // "Новое в рубрике" hero: only in the untouched default view (no active
  // search/topic/filter/sort), and only when something is genuinely recent —
  // showing a "new" hero over month-old content is exactly the trust problem
  // this whole browser is meant to fix.
  const heroArticles = useMemo(() => {
    if (!isCleanState) return []
    return [...allArticles]
      .filter((a) => isRecentArticle(a.date, HERO_RECENCY_DAYS))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 3)
  }, [isCleanState, allArticles])

  const heroSlugs = useMemo(() => new Set(heroArticles.map((a) => a.slug)), [heroArticles])

  const filtered = useMemo(() => {
    const withoutHero = heroSlugs.size > 0 ? filteredBase.filter((a) => !heroSlugs.has(a.slug)) : filteredBase
    if (!isCleanState) return withoutHero
    // Default "newest" view only: keep it mostly chronological but stop six
    // posts about the same narrow topic from running back to back.
    return limitConsecutiveTopics(withoutHero, (a) => a.tags?.[0], 2)
  }, [filteredBase, heroSlugs, isCleanState])

  // Any change to the filter set collapses back to the first window.
  // Adjust-state-during-render pattern (no effect, no cascading render).
  const filterKey = `${query.trim()}|${sortMode}|${topic}|${difficulty}|${timeFilter}|${costFilter}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setVisibleCount(PAGE_SIZE)
  }

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const totalShown = filtered.length + heroArticles.length

  return (
    <section aria-label="Подбор статей раздела">
      {heroArticles.length > 0 && (
        <div className="category-browser-hero" aria-label="Новое в рубрике">
          <h2 className="category-browser-hero-title">🆕 Новое в рубрике</h2>
          <div className="category-browser-hero-grid" data-count={heroArticles.length}>
            <ArticleCard article={heroArticles[0]} wordCount={heroArticles[0].wordCount} featured hideCategoryBadge hideShareButton />
            {heroArticles.length > 1 && (
              <div className="category-browser-hero-side">
                {heroArticles.slice(1, 3).map((article) => (
                  <ArticleCard key={article.slug} article={article} wordCount={article.wordCount} hideCategoryBadge hideShareButton />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="category-browser">
        <div className="category-browser-search">
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
          <button
            type="button"
            className={`category-browser-filters-toggle${activeFilterCount > 0 ? ' active' : ''}`}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            Фильтры{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {filtersOpen && (
          <div className="category-browser-filters" aria-label="Фильтры">
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Сложность">
              <option value="">Любая сложность</option>
              <option value="Легко">Легко ★</option>
              <option value="Средне">Средне ★★★</option>
              <option value="Сложно">Сложно ★★★★★</option>
            </select>
            <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)} aria-label="Время">
              <option value="">Любое время</option>
              <option value="short">До 15 минут</option>
              <option value="medium">15–60 минут</option>
              <option value="long">1–3 часа</option>
              <option value="verylong">Больше 3 часов</option>
            </select>
            <select value={costFilter} onChange={(event) => setCostFilter(event.target.value)} aria-label="Бюджет">
              <option value="">Любой бюджет</option>
              <option value="free">Бесплатно</option>
              <option value="cheap">До 500 ₽</option>
              <option value="medium">500–1500 ₽</option>
              <option value="expensive">Больше 1500 ₽</option>
            </select>
          </div>
        )}

        {topicOptions.length > 0 && (
          <div className="category-browser-tags" aria-label={usingThemes ? 'Темы раздела' : 'Популярные темы раздела'}>
            <button type="button" className={topic === '' ? 'active' : ''} onClick={() => setTopic('')}>
              Все темы
            </button>
            {topicOptions.map((item) => (
              <button key={item} type="button" className={topic === item ? 'active' : ''} onClick={() => setTopic(item)}>
                {item}
              </button>
            ))}
          </div>
        )}

        <div className="category-browser-count" aria-live="polite">
          Найдено: {totalShown} из {allArticles.length}
        </div>
      </div>

      {filtered.length === 0 && heroArticles.length === 0 ? (
        <div className="category-browser-empty">
          Ничего не найдено. Попробуйте убрать тему или сократить запрос.
        </div>
      ) : (
        <>
          <ArticleCatalogGrid articles={visible} hideCategoryBadge hideShareButton />
          {visibleCount < filtered.length && (
            <div className="category-browser-more">
              <button
                type="button"
                onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}
              >
                Показать ещё ({filtered.length - visibleCount})
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .category-browser-hero {
          margin: 0 0 1.5rem;
        }
        .category-browser-hero-title {
          font-size: 1.1rem;
          font-weight: 800;
          color: #1a1a1a;
          margin: 0 0 0.75rem;
        }
        .category-browser-hero-grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: 1fr;
        }
        .category-browser-hero-grid[data-count='2'],
        .category-browser-hero-grid[data-count='3'] {
          grid-template-columns: 1.4fr 1fr;
        }
        .category-browser-hero-side {
          display: grid;
          gap: 0.75rem;
        }
        @media (max-width: 720px) {
          .category-browser-hero-grid[data-count='2'],
          .category-browser-hero-grid[data-count='3'] {
            grid-template-columns: 1fr;
          }
        }
        .category-browser {
          display: grid;
          gap: 0.5rem;
          margin: 0 0 1rem;
          padding: 0.55rem 0.6rem;
          border: 1px solid #ebe2db;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .category-browser-search {
          display: grid;
          grid-template-columns: minmax(0, 260px) minmax(130px, 160px) auto;
          gap: 0.5rem;
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
          height: 32px;
          border: 1px solid #ded4cc;
          border-radius: 7px;
          background: #fff;
          color: #222;
          font: inherit;
          font-size: 0.85rem;
          outline: none;
        }
        .category-browser-search input {
          padding: 0 0.7rem 0 2.1rem;
        }
        .category-browser-search select {
          padding: 0 0.55rem;
        }
        .category-browser-search input:focus,
        .category-browser-search select:focus,
        .category-browser-filters select:focus {
          border-color: #c0392b;
          box-shadow: 0 0 0 3px #c0392b14;
        }
        .category-browser-filters-toggle {
          height: 32px;
          padding: 0 0.85rem;
          border: 1px solid #ded4cc;
          border-radius: 7px;
          background: #fff;
          color: #555;
          font: inherit;
          font-size: 0.83rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
        }
        .category-browser-filters-toggle.active {
          border-color: #c0392b66;
          background: #c0392b0d;
          color: #b73226;
        }
        .category-browser-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .category-browser-filters select {
          width: auto;
          min-width: 130px;
          height: 32px;
          border: 1px solid #ded4cc;
          border-radius: 7px;
          background: #fff;
          color: #222;
          font: inherit;
          font-size: 0.83rem;
          padding: 0 0.55rem;
          outline: none;
        }
        @media (max-width: 680px) {
          .category-browser-filters select {
            flex: 1 1 auto;
          }
        }
        .category-browser-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }
        .category-browser-tags button {
          border: 1px solid #e3d9d1;
          border-radius: 999px;
          background: #faf8f6;
          color: #555;
          font: inherit;
          font-size: 0.76rem;
          font-weight: 700;
          padding: 0.24rem 0.6rem;
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
        .category-browser-more {
          display: flex;
          justify-content: center;
          margin-top: 1.5rem;
        }
        .category-browser-more button {
          border: 1px solid #ded4cc;
          border-radius: 999px;
          background: #fff;
          color: #b73226;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 700;
          padding: 0.55rem 1.4rem;
          cursor: pointer;
        }
        .category-browser-more button:hover {
          border-color: #c0392b66;
          background: #c0392b0a;
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
