'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'
import { CATEGORY_COLOR, CATEGORY_EMOJI, relativeDate } from '@/lib/utils'
import { searchArticles } from '@/lib/search'

interface ArticleData {
  title: string
  description: string
  tags: string[]
  category: string
  categoryName: string
  slug: string
  date: string
  wordCount?: number
}

interface Props {
  articles: ArticleData[]
}

function getUrlQuery(): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('q') || ''
}

export default function SearchClient({ articles }: Props) {
  const [query, setQuery] = useState(getUrlQuery)
  const [debouncedQuery, setDebouncedQuery] = useState(getUrlQuery)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const articleJson = JSON.stringify(articles).replace(/</g, '\\u003c')

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 200)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    return searchArticles(articles, debouncedQuery)
  }, [debouncedQuery, articles])

  const hasQuery = debouncedQuery.trim().length > 0

  return (
    <div data-search-page style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.4rem', color: '#1a1a1a' }}>
        Поиск
      </h1>
      <p style={{ color: '#888', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        {articles.length} статей на сайте
      </p>

      {/* Search input */}
      <form action="/search/" method="get" role="search" style={{ position: 'relative', marginBottom: '2rem' }}>
        <span style={{
          position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
          fontSize: '1.1rem', pointerEvents: 'none', color: '#aaa',
        }}>
          🔍
        </span>
        <input
          type="search"
          name="q"
          autoFocus
          suppressHydrationWarning
          placeholder="Введите запрос — например: борщ, уборка, огород..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.85rem 1rem 0.85rem 2.8rem',
            fontSize: '1rem',
            borderRadius: '10px',
            border: '2px solid #e8e4df',
            outline: 'none',
            backgroundColor: '#fff',
            boxSizing: 'border-box',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#c0392b' }}
          onBlur={(e) => { e.target.style.borderColor = '#e8e4df' }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{
              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#bbb', fontSize: '1.1rem', lineHeight: 1, padding: '4px',
            }}
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </form>
      <style dangerouslySetInnerHTML={{ __html: '[data-search-page][data-has-static-results="1"] [data-search-browse]{display:none!important}' }} />
      <div data-search-fallback-results style={{ display: 'none' }} />
      <script id="search-page-data" type="application/json" dangerouslySetInnerHTML={{ __html: articleJson }} />
      <script dangerouslySetInnerHTML={{ __html: searchPageBootstrap }} />

      {/* Results */}
      {hasQuery ? (
        results.length > 0 ? (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>
              Найдено: {results.length} {results.length === 1 ? 'статья' : results.length < 5 ? 'статьи' : 'статей'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.map((article) => {
                const color = CATEGORY_COLOR[article.category] || '#888'
                const emoji = CATEGORY_EMOJI[article.category] || '📄'
                const cat = CATEGORIES[article.category]
                return (
                  <Link
                    key={article.slug}
                    href={`/${article.category}/${article.slug}`}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{
                      backgroundColor: '#fff',
                      borderRadius: '10px',
                      border: '1.5px solid #e8e4df',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'flex-start',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget
                        el.style.borderColor = color
                        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget
                        el.style.borderColor = '#e8e4df'
                        el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <div style={{
                        width: '48px', height: '48px', flexShrink: 0,
                        borderRadius: '8px',
                        background: `linear-gradient(135deg, ${color}cc, ${color}66)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem',
                      }}>
                        {emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                            backgroundColor: color + '18', color,
                            borderRadius: '4px', padding: '2px 7px',
                          }}>
                            {cat?.name || article.categoryName}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#bbb' }}>{relativeDate(article.date)}</span>
                        </div>
                        <h3 style={{ fontSize: '0.97rem', fontWeight: 700, color: '#1a1a1a', margin: '0 0 0.3rem', lineHeight: 1.4 }}>
                          {article.title}
                        </h3>
                        <p style={{ fontSize: '0.83rem', color: '#666', margin: 0, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {article.description}
                        </p>
                        {article.tags.length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {article.tags.slice(0, 4).map((tag) => (
                              <span key={tag} style={{
                                fontSize: '0.72rem', color: '#999',
                                backgroundColor: '#f5f2ef', borderRadius: '3px', padding: '1px 6px',
                              }}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#444', marginBottom: '0.5rem' }}>
              Ничего не найдено
            </p>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>
              Попробуйте другой запрос или посмотрите все разделы ниже
            </p>
          </div>
        )
      ) : (
        /* Browse state — show categories and tag hints */
        <div data-search-browse>
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#555', marginBottom: '0.9rem' }}>По разделу</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {Object.values(CATEGORIES).map((cat) => {
                const color = CATEGORY_COLOR[cat.slug] || '#888'
                const emoji = CATEGORY_EMOJI[cat.slug] || '📄'
                const count = articles.filter((a) => a.category === cat.slug).length
                return (
                  <Link key={cat.slug} href={`/${cat.slug}`} style={{
                    padding: '0.5rem 1rem', borderRadius: '8px', border: `1.5px solid ${color}44`,
                    textDecoration: 'none', color, fontSize: '0.9rem', fontWeight: 600,
                    backgroundColor: color + '0d', display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}>
                    {emoji} {cat.name} <span style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 400 }}>({count})</span>
                  </Link>
                )
              })}
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#aaa', textAlign: 'center', padding: '1rem' }}>
            Начните вводить запрос для поиска по {articles.length} статьям
          </div>
        </div>
      )}
    </div>
  )
}

const searchPageBootstrap = String.raw`
(() => {
  const root = document.querySelector('[data-search-page]');
  if (!root || root.dataset.staticReady === '1') return;
  root.dataset.staticReady = '1';

  const input = root.querySelector('input[name="q"]');
  const box = root.querySelector('[data-search-fallback-results]');
  const browse = root.querySelector('[data-search-browse]');
  const dataNode = root.querySelector('#search-page-data');
  const query = new URLSearchParams(window.location.search).get('q') || '';
  if (!input || !box || !dataNode || query.trim().length < 1) return;

  input.value = query;
  const articles = JSON.parse(dataNode.textContent || '[]');
  const stops = new Set(['а','без','бы','в','во','для','до','за','и','из','или','как','ко','на','над','не','о','об','от','по','под','при','про','с','со','у','что','это']);
  const suffixes = ['ться','тся','ся','иями','ями','ами','ого','его','ому','ему','ыми','ими','иях','ах','ях','ов','ев','ей','ой','ый','ий','ая','яя','ое','ее','ые','ие','ую','юю','ом','ем','ам','ям','а','я','ы','и','у','ю','е','о'];
  const colors = { kulinaria: '#e67e22', 'dom-i-uborka': '#27ae60', 'dacha-i-ogorod': '#16a085', layfkhaki: '#8e44ad', ekonomiya: '#2980b9', rybalka: '#555' };

  function norm(value) {
    return String(value || '').toLowerCase().replaceAll('ё', 'е').replace(/[^a-zа-я0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function stem(token) {
    const clean = norm(token).replace(/[-ьъ]/g, '');
    if (clean.length <= 4) return clean;
    for (const suffix of suffixes) {
      if (clean.endsWith(suffix) && clean.length - suffix.length >= 4) return clean.slice(0, -suffix.length);
    }
    return clean;
  }

  function tokens(value) {
    return [...new Set(norm(value).split(/\s+/).map(stem).filter((token) => token.length >= 3 && !stops.has(token)))];
  }

  function score(article, value) {
    const queryTokens = tokens(value);
    if (!queryTokens.length) return 0;
    const title = norm(article.title);
    const description = norm(article.description);
    const tags = norm((article.tags || []).join(' '));
    const category = norm(article.categoryName + ' ' + article.category);
    const all = title + ' ' + description + ' ' + tags + ' ' + category;
    const stems = [...new Set(all.split(/\s+/).map(stem).filter((token) => token.length >= 3))];
    let total = 0;
    for (const token of queryTokens) {
      if (title.includes(token)) total += 24;
      if (tags.includes(token)) total += 20;
      if (description.includes(token)) total += 12;
      if (category.includes(token)) total += 5;
      if (stems.includes(token)) total += 12;
      else if (stems.some((s) => s.includes(token) || token.includes(s))) total += 7;
    }
    const matched = queryTokens.filter((token) => all.includes(token) || stems.some((s) => s.includes(token) || token.includes(s)));
    if (matched.length === queryTokens.length) total += 15;
    if (title.includes(norm(value))) total += 30;
    return total;
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  const results = articles
    .map((article) => ({ ...article, score: score(article, query) }))
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.date) - Date.parse(a.date));

  if (browse) browse.style.display = 'none';
  root.dataset.hasStaticResults = '1';
  box.style.display = 'block';
  if (!results.length) {
    box.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:2.5rem;margin-bottom:.75rem">🔍</div><p style="font-size:1.1rem;font-weight:600;color:#444;margin:0 0 .5rem">Ничего не найдено</p><p style="color:#888;font-size:.9rem;margin:0">Попробуйте другой запрос.</p></div>';
    return;
  }

  box.innerHTML = [
    '<p style="font-size:.85rem;color:#888;margin:0 0 1rem">Найдено: ' + results.length + ' статей</p>',
    '<div style="display:flex;flex-direction:column;gap:.75rem">',
    results.map((article) => {
      const color = colors[article.category] || '#888';
      const href = '/' + article.category + '/' + article.slug + '/';
      return [
        '<a href="' + href + '" style="text-decoration:none;color:inherit">',
        '<div style="background:#fff;border-radius:10px;border:1.5px solid #e8e4df;padding:1rem 1.25rem;display:flex;gap:1rem;align-items:flex-start;box-shadow:0 1px 4px rgba(0,0,0,.05)">',
        '<div style="width:48px;height:48px;flex-shrink:0;border-radius:8px;background:' + color + '18;display:flex;align-items:center;justify-content:center;color:' + color + ';font-weight:800">#</div>',
        '<div style="flex:1;min-width:0">',
        '<div style="margin-bottom:.3rem"><span style="font-size:.7rem;font-weight:700;text-transform:uppercase;background:' + color + '18;color:' + color + ';border-radius:4px;padding:2px 7px">' + escapeHtml(article.categoryName) + '</span></div>',
        '<h3 style="font-size:.97rem;font-weight:700;color:#1a1a1a;margin:0 0 .3rem;line-height:1.4">' + escapeHtml(article.title) + '</h3>',
        '<p style="font-size:.83rem;color:#666;margin:0;line-height:1.5">' + escapeHtml(article.description) + '</p>',
        '</div></div></a>',
      ].join('');
    }).join(''),
    '</div>',
  ].join('');
})();
`
