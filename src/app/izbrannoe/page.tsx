'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSupabase } from '@/lib/supabase'
import { getArticleMeta } from '@/lib/article-index'
import { getLocalFavorites, saveLocalFavorites } from '@/lib/favorites'
import {
  Collection,
  getUserCollections,
  deleteCollection,
  toggleCollectionPublic,
  getCollectionItems,
  createCollection,
} from '@/lib/collections'

interface FavItem {
  slug: string
  category: string
  title: string
}

interface CollectionWithCount extends Collection {
  itemCount: number
}

export default function FavoritesPage() {
  const [items, setItems] = useState<FavItem[]>([])
  const [loading, setLoading] = useState(true)
  const [collections, setCollections] = useState<CollectionWithCount[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null)
  const [collectionItems, setCollectionItems] = useState<Record<string, FavItem[]>>({})
  const [collectionItemsLoading, setCollectionItemsLoading] = useState<Record<string, boolean>>({})
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [createError, setCreateError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

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

      try {
        const sb = getSupabase()
        const { data: u } = await sb.auth.getUser()
        if (cancelled) return
        const uid = u.user?.id ?? null
        setUserId(uid)

        if (uid) {
          const [{ data: dbRows }, cols] = await Promise.all([
            sb.from('saved_articles').select('article_slug').eq('user_id', uid),
            getUserCollections(sb),
          ])
          if (cancelled) return
          const dbSlugs = (dbRows || []).map((r: { article_slug: string }) => r.article_slug)
          setItems(resolve([...local, ...dbSlugs]))

          if (cols.length > 0) {
            const colIds = cols.map((c) => c.id)
            const { data: countRows } = await sb
              .from('collection_items')
              .select('collection_id')
              .in('collection_id', colIds)
            const counts: Record<string, number> = {}
            ;(countRows || []).forEach((r: { collection_id: string }) => {
              counts[r.collection_id] = (counts[r.collection_id] || 0) + 1
            })
            setCollections(cols.map((c) => ({ ...c, itemCount: counts[c.id] || 0 })))
          } else {
            setCollections([])
          }
          setCollectionsLoading(false)
        } else {
          setCollectionsLoading(false)
        }
      } catch {
        setCollectionsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const remove = (slug: string) => {
    const local = getLocalFavorites().filter((s) => s !== slug)
    saveLocalFavorites(local)
    setItems((prev) => prev.filter((i) => i.slug !== slug))
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

  const toggleExpand = async (collectionId: string) => {
    if (expandedCollection === collectionId) {
      setExpandedCollection(null)
      return
    }
    setExpandedCollection(collectionId)
    if (collectionItems[collectionId]) return

    setCollectionItemsLoading((prev) => ({ ...prev, [collectionId]: true }))
    try {
      const sb = getSupabase()
      const slugs = await getCollectionItems(sb, collectionId)
      setCollectionItems((prev) => ({ ...prev, [collectionId]: resolve(slugs) }))
    } catch {
      setCollectionItems((prev) => ({ ...prev, [collectionId]: [] }))
    } finally {
      setCollectionItemsLoading((prev) => ({ ...prev, [collectionId]: false }))
    }
  }

  const handleDelete = async (collectionId: string, name: string) => {
    if (!confirm(`Удалить коллекцию «${name}»? Статьи из неё не удалятся.`)) return
    try {
      const sb = getSupabase()
      await deleteCollection(sb, collectionId)
      setCollections((prev) => prev.filter((c) => c.id !== collectionId))
      if (expandedCollection === collectionId) setExpandedCollection(null)
    } catch {
      alert('Не удалось удалить коллекцию')
    }
  }

  const handleTogglePublic = async (collection: CollectionWithCount) => {
    try {
      const sb = getSupabase()
      await toggleCollectionPublic(sb, collection.id, !collection.is_public)
      setCollections((prev) =>
        prev.map((c) => (c.id === collection.id ? { ...c, is_public: !c.is_public } : c))
      )
    } catch {
      alert('Не удалось изменить видимость')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCollectionName.trim()) return
    setCreateError('')
    try {
      const sb = getSupabase()
      const col = await createCollection(sb, newCollectionName.trim())
      setCollections((prev) => [{ ...col, itemCount: 0 }, ...prev])
      setNewCollectionName('')
      setShowCreateForm(false)
    } catch (err) {
      setCreateError((err as Error).message || 'Не удалось создать коллекцию')
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.25rem' }}>
        ❤️ Избранное
      </h1>
      <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 2rem' }}>
        Статьи, которые вы сохранили. Войдите, чтобы они синхронизировались на всех устройствах.
      </p>

      {/* Collections */}
      {userId && (
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#333', margin: 0 }}>
              📁 Мои коллекции
            </h2>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                style={{
                  background: '#c0392b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + Новая коллекция
              </button>
            )}
          </div>

          {showCreateForm && (
            <form
              onSubmit={handleCreate}
              style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-start' }}
            >
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Название коллекции"
                autoFocus
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="submit"
                disabled={!newCollectionName.trim()}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#c0392b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: !newCollectionName.trim() ? 0.6 : 1,
                }}
              >
                Создать
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false)
                  setCreateError('')
                  setNewCollectionName('')
                }}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: '#f5f3f0',
                  color: '#666',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Отмена
              </button>
            </form>
          )}
          {createError && (
            <div style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {createError}
            </div>
          )}

          {collectionsLoading ? (
            <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Загрузка коллекций…</p>
          ) : collections.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Пока нет коллекций. Создайте первую!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {collections.map((col) => (
                <div
                  key={col.id}
                  style={{ border: '1px solid #e8e4df', borderRadius: '10px', overflow: 'hidden' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      background: expandedCollection === col.id ? '#faf8f5' : '#fff',
                      transition: 'background 0.15s',
                    }}
                    onClick={() => toggleExpand(col.id)}
                  >
                    <span style={{ fontSize: '1.1rem' }}>📁</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1a1a1a' }}>
                        {col.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#888' }}>
                        {col.itemCount} {col.itemCount === 1 ? 'статья' : col.itemCount < 5 ? 'статьи' : 'статей'}
                        {' · '}
                        {col.is_public ? '🌐 Публичная' : '🔒 Приватная'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {col.is_public && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = `/kollekcii/${col.owner_id}/${col.slug}/`
                          }}
                          title="Открыть публичную ссылку"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            padding: '2px 4px',
                            lineHeight: 1,
                          }}
                        >
                          🔗
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTogglePublic(col)
                        }}
                        title={col.is_public ? 'Сделать приватной' : 'Сделать публичной'}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          padding: '2px 4px',
                          lineHeight: 1,
                        }}
                      >
                        {col.is_public ? '👁️' : '🚫'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(col.id, col.name)
                        }}
                        title="Удалить"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#bbb',
                          fontSize: '1.1rem',
                          padding: '2px 6px',
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          color: '#aaa',
                          transition: 'transform 0.2s',
                          transform: expandedCollection === col.id ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        ▼
                      </span>
                    </div>
                  </div>

                  {expandedCollection === col.id && (
                    <div
                      style={{
                        padding: '0.5rem 1rem 1rem',
                        background: '#faf8f5',
                        borderTop: '1px solid #f0eeeb',
                      }}
                    >
                      {collectionItemsLoading[col.id] ? (
                        <p style={{ color: '#aaa', fontSize: '0.85rem' }}>Загрузка…</p>
                      ) : (collectionItems[col.id] || []).length === 0 ? (
                        <p style={{ color: '#aaa', fontSize: '0.85rem' }}>В коллекции пока нет статей</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {(collectionItems[col.id] || []).map((item) => (
                            <div
                              key={item.slug}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: '#fff',
                                borderRadius: '6px',
                                padding: '0.5rem 0.75rem',
                              }}
                            >
                              <Link
                                href={`/${item.category}/${item.slug}/`}
                                style={{
                                  flex: 1,
                                  color: '#1a1a1a',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                  fontSize: '0.88rem',
                                }}
                              >
                                {item.title}
                              </Link>
                              <button
                                onClick={async () => {
                                  try {
                                    const sb = getSupabase()
                                    const { removeFromCollection } = await import('@/lib/collections')
                                    await removeFromCollection(sb, col.id, item.slug)
                                    setCollectionItems((prev) => ({
                                      ...prev,
                                      [col.id]: (prev[col.id] || []).filter((i) => i.slug !== item.slug),
                                    }))
                                    setCollections((prev) =>
                                      prev.map((c) =>
                                        c.id === col.id ? { ...c, itemCount: c.itemCount - 1 } : c
                                      )
                                    )
                                  } catch {
                                    alert('Не удалось удалить')
                                  }
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#bbb',
                                  fontSize: '1rem',
                                  lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {col.is_public && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#888' }}>
                          Ссылка:{' '}
                          <Link
                            href={`/kollekcii/${col.owner_id}/${col.slug}/`}
                            style={{ color: '#c0392b', textDecoration: 'none' }}
                          >
                            /kollekcii/{col.owner_id}/{col.slug}/
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legacy Избранное */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#333', margin: '0 0 1rem' }}>
        ❤️ Избранное
      </h2>

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
                background: '#fff',
                border: '1px solid #e8e4df',
                borderRadius: '8px',
                padding: '0.9rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>❤️</span>
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
              <button
                onClick={() => remove(item.slug)}
                aria-label="Убрать из избранного"
                title="Убрать из избранного"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#bbb',
                  fontSize: '1.1rem',
                  padding: '2px 6px',
                  lineHeight: 1,
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
