'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getArticleMeta } from '@/lib/article-index'
import { getPublicCollection } from '@/lib/collections'
import type { Collection } from '@/lib/collections'

interface FavItem {
  slug: string
  category: string
  title: string
}

export default function PublicCollectionView() {
  const params = useParams()
  const userId = params?.userId as string | undefined
  const slug = params?.slug as string | undefined

  const [loading, setLoading] = useState(!userId || !slug)
  const [collection, setCollection] = useState<Collection | null>(null)
  const [items, setItems] = useState<FavItem[]>([])
  const [error, setError] = useState(!userId || !slug ? 'Коллекция не найдена' : '')

  useEffect(() => {
    if (error || !userId || !slug) return
    let cancelled = false

    ;(async () => {
      try {
        const sb = getSupabase()
        const result = await getPublicCollection(sb, userId, slug)
        if (cancelled) return
        if (!result) {
          setError('Коллекция не найдена или она приватная')
          setLoading(false)
          return
        }
        setCollection(result.collection)
        const resolved = result.items
          .map((slug) => {
            const meta = getArticleMeta(slug)
            return meta ? { slug, category: meta.category, title: meta.title } : null
          })
          .filter((x): x is FavItem => x !== null)
        setItems(resolved)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError('Не удалось загрузить коллекцию')
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, slug, error])

  // Update document title when collection is loaded
  useEffect(() => {
    if (collection) {
      document.title = `${collection.name} — коллекция | СоветыДома`
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'description'
        document.head.appendChild(meta)
      }
      meta.content = `Коллекция «${collection.name}» на СоветыДома`
    }
  }, [collection])

  if (loading) {
    return (
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '4rem 1rem',
          textAlign: 'center',
          color: '#aaa',
        }}
      >
        Загрузка…
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', color: '#1a1a1a', marginBottom: '1rem' }}>Коллекция не найдена</h1>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>
          {error || 'Эта коллекция может быть приватной или удалена.'}
        </p>
        <Link href="/" style={{ color: '#c0392b', fontWeight: 600, textDecoration: 'none' }}>
          На главную →
        </Link>
      </div>
    )
  }

  return (
    <>
      {/*
        SEO note: this page is client-side rendered (use client). Search-engine crawlers
        that do not execute JavaScript will not index the collection content. For full SEO
        coverage, consider a server-side or edge-rendered version, or add a `_redirects`
        / `_routes.json` fallback that routes all /kollekcii/* requests to the SPA entry.
      */}

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
            <Link href="/" style={{ color: '#c0392b', textDecoration: 'none' }}>
              СоветыДома
            </Link>
            {' → '}
            <span>Публичная коллекция</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.5rem' }}>
            📁 {collection.name}
          </h1>
          <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>
            {items.length} {items.length === 1 ? 'статья' : items.length < 5 ? 'статьи' : 'статей'}
            {' · '}
            🌐 Публичная коллекция
          </p>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#aaa',
              padding: '3rem 0',
              background: '#faf8f5',
              borderRadius: '10px',
            }}
          >
            <p>В коллекции пока нет статей</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {items.map((item) => (
              <div
                key={item.slug}
                style={{
                  background: '#fff',
                  border: '1px solid #e8e4df',
                  borderRadius: '8px',
                  padding: '0.9rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>📄</span>
                <Link
                  href={`/${item.category}/${item.slug}/`}
                  style={{
                    flex: 1,
                    color: '#1a1a1a',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.93rem',
                  }}
                >
                  {item.title}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
