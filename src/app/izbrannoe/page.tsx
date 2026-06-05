'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getArticleMeta } from '@/lib/article-index'
import { getLocalFavorites } from '@/lib/favorites'

interface FavItem {
  slug: string
  category: string
  title: string
}

export default function FavoritesPage() {
  const [items, setItems] = useState<FavItem[]>([])
  const [loading, setLoading] = useState(true)

  const resolve = (slugs: string[]): FavItem[] =>
    Array.from(new Set(slugs))
      .map((slug) => {
        const meta = getArticleMeta(slug)
        return meta ? { slug, category: meta.category, title: meta.title } : null
      })
      .filter((x): x is FavItem => x !== null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.resolve()
      if (cancelled) return

      const local = getLocalFavorites()
      setItems(resolve(local))
      setLoading(false)

      // Merge in DB-backed saves when logged in (cross-device favorites).
      try {
        const sb = getSupabase()
        const { data: u } = await sb.auth.getUser()
        if (cancelled) return
        if (u.user) {
          const { data } = await sb
            .from('saved_articles')
            .select('article_slug')
            .eq('user_id', u.user.id)
          const dbSlugs = (data || []).map((r: { article_slug: string }) => r.article_slug)
          if (cancelled) return
          setItems(resolve([...local, ...dbSlugs]))
        }
      } catch {
        // localStorage-only mode
      }
    })()
    return () => { cancelled = true }
  }, [])

  const remove = (slug: string) => {
    const local = getLocalFavorites().filter((s) => s !== slug)
    localStorage.setItem('favorites', JSON.stringify(local))
    setItems((prev) => prev.filter((i) => i.slug !== slug))
    // Best-effort DB removal too
    ;(async () => {
      try {
        const sb = getSupabase()
        const { data: u } = await sb.auth.getUser()
        if (u.user) {
          await sb.from('saved_articles').delete().eq('user_id', u.user.id).eq('article_slug', slug)
        }
      } catch {
        /* ignore */
      }
    })()
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.25rem' }}>
        ❤️ Избранное
      </h1>
      <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 2rem' }}>
        Статьи, которые вы сохранили. Войдите, чтобы они синхронизировались на всех устройствах.
      </p>

      {loading ? (
        <p style={{ color: '#aaa', textAlign: 'center', padding: '3rem 0' }}>Загрузка…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '3rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🤍</div>
          <p style={{ marginBottom: '1rem' }}>Пока нет сохранённых статей</p>
          <Link href="/" style={{ color: '#c0392b', fontWeight: 600, textDecoration: 'none' }}>
            Найти что-нибудь интересное →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((item) => (
            <div
              key={item.slug}
              style={{
                background: '#fff', border: '1px solid #e8e4df', borderRadius: '8px',
                padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>❤️</span>
              <Link
                href={`/${item.category}/${item.slug}/`}
                style={{ flex: 1, color: '#1a1a1a', textDecoration: 'none', fontWeight: 600, fontSize: '0.93rem' }}
              >
                {item.title}
              </Link>
              <button
                onClick={() => remove(item.slug)}
                aria-label="Убрать из избранного"
                title="Убрать из избранного"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#bbb', fontSize: '1.1rem', padding: '2px 6px', lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
