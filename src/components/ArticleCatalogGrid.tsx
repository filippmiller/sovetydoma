'use client'

import { useEffect, useMemo, useState } from 'react'
import ArticleCard from '@/components/ArticleCard'
import { ArticleFrontmatter } from '@/lib/articles'
import { getSupabase } from '@/lib/supabase'
import { ArticleStatsMap, buildArticleStatsMap } from '@/lib/article-stats'

interface Props {
  articles: (ArticleFrontmatter & { wordCount?: number })[]
}

export default function ArticleCatalogGrid({ articles }: Props) {
  const [stats, setStats] = useState<ArticleStatsMap>({})
  const slugs = useMemo(() => articles.map((article) => article.slug), [articles])

  useEffect(() => {
    if (slugs.length === 0) return
    let active = true

    async function load() {
      try {
        const sb = getSupabase()
        const [counters, ratings, reactions] = await Promise.all([
          sb.from('feedback_counters').select('article_slug, kind, count').in('article_slug', slugs),
          sb.from('ratings').select('article_slug, stars').in('article_slug', slugs),
          sb.from('reactions').select('article_slug, emoji').in('article_slug', slugs),
        ])

        if (!active) return
        setStats(buildArticleStatsMap(slugs, {
          counters: counters.data || [],
          ratings: ratings.data || [],
          reactions: reactions.data || [],
        }))
      } catch {
        if (active) setStats(buildArticleStatsMap(slugs, {}))
      }
    }

    load()
    return () => { active = false }
  }, [slugs])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
      {articles.map((article, i) => {
        const articleStats = stats[article.slug]
        return (
          <ArticleCard
            key={article.slug}
            article={article}
            wordCount={article.wordCount}
            featured={i === 0}
            viewCount={articleStats?.viewCount}
            ratingAverage={articleStats?.ratingAverage}
            likeCount={articleStats?.likeCount}
          />
        )
      })}
    </div>
  )
}
