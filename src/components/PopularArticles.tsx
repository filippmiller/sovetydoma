'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CATEGORY_COLOR, CATEGORY_EMOJI } from '@/lib/utils'
import { CATEGORIES } from '@/lib/categories'
import { getSupabase } from '@/lib/supabase'
import { sortArticlesByViews } from '@/lib/view-counts.mjs'

interface ArticleData {
  title: string
  slug: string
  category: string
  categoryName: string
  date: string
}

type ArticleWithViews = ArticleData & { viewCount?: number }

interface Props {
  articles: ArticleData[]
}

export default function PopularArticles({ articles }: Props) {
  const [topArticles, setTopArticles] = useState<ArticleWithViews[]>([])
  const [fromViews, setFromViews] = useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const sb = getSupabase()
        // We only need the most-viewed articles to compute a top-5, so bound the
        // query instead of scanning the whole (ever-growing) counters table.
        const { data } = await sb
          .from('feedback_counters')
          .select('article_slug, kind, count')
          .eq('kind', 'view')
          .order('count', { ascending: false })
          .limit(200)

        const sorted = sortArticlesByViews(articles, data || [])
        const hasViews = sorted.some((article) => article.viewCount > 0)
        if (!active) return
        setFromViews(hasViews)
        setTopArticles((hasViews ? sorted : newest(articles)).slice(0, 5))
      } catch {
        if (!active) return
        setFromViews(false)
        setTopArticles(newest(articles).slice(0, 5))
      }
    }

    load()
    return () => { active = false }
  }, [articles])

  if (topArticles.length === 0) return null

  return (
    <section style={{
      margin: '2.5rem 0',
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e8e4df',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem' }}>
        <span style={{ fontSize: '1.2rem' }}>🔥</span>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          Популярное
        </h2>
        {fromViews && (
          <span style={{ fontSize: '0.75rem', color: '#aaa', marginLeft: '0.25rem' }}>— по просмотрам</span>
        )}
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {topArticles.map((article, i) => {
          const views = Number(article.viewCount || 0)
          const color = CATEGORY_COLOR[article.category] || '#888'
          const emoji = CATEGORY_EMOJI[article.category] || '📄'
          const cat = CATEGORIES[article.category]
          return (
            <li key={article.slug}>
              <Link
                href={`/${article.category}/${article.slug}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
              >
                <span style={{
                  fontWeight: 800, fontSize: '1rem', color: i === 0 ? '#c0392b' : '#ddd',
                  minWidth: '1.4rem', textAlign: 'center',
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize: '1rem', width: '28px', height: '28px', flexShrink: 0,
                  borderRadius: '6px',
                  background: `linear-gradient(135deg, ${color}cc, ${color}66)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {emoji}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {article.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '1px' }}>
                    {cat?.name || article.categoryName}{views > 0 ? ` · 👁 ${views}` : ''}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function newest<T extends { date: string }>(articles: T[]): T[] {
  return [...articles].sort((a, b) => (a.date < b.date ? 1 : -1))
}
