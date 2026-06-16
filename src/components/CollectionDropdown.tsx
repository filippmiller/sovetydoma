'use client'

import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'
import {
  Collection,
  getCollectionsWithArticleState,
  createCollection,
  addToCollection,
  removeFromCollection,
} from '@/lib/collections'

interface Props {
  slug: string
  userId: string
  isSaved: boolean
  onToggleSaved: () => void
  onClose: () => void
  position?: 'center' | 'right'
}

export default function CollectionDropdown({
  slug,
  isSaved,
  onToggleSaved,
  onClose,
  position = 'center',
}: Props) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [inCollections, setInCollections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sb = getSupabase()
        const { collections: cols, inCollectionIds } = await getCollectionsWithArticleState(sb, slug)
        if (!cancelled) {
          setCollections(cols)
          setInCollections(inCollectionIds)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  // Close on outside click and Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const toggleCollection = async (collectionId: string) => {
    const sb = getSupabase()
    const isIn = inCollections.has(collectionId)
    try {
      if (isIn) {
        await removeFromCollection(sb, collectionId, slug)
        setInCollections((prev) => {
          const next = new Set(prev)
          next.delete(collectionId)
          return next
        })
      } else {
        await addToCollection(sb, collectionId, slug)
        setInCollections((prev) => {
          const next = new Set(prev)
          next.add(collectionId)
          return next
        })
      }
    } catch (err) {
      console.error('Failed to toggle collection:', err)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreateError('')
    try {
      const sb = getSupabase()
      const col = await createCollection(sb, newName.trim())
      await addToCollection(sb, col.id, slug)
      setCollections((prev) => [col, ...prev])
      setInCollections((prev) => {
        const next = new Set(prev)
        next.add(col.id)
        return next
      })
      setNewName('')
      setCreating(false)
    } catch (err) {
      setCreateError((err as Error).message || 'Не удалось создать коллекцию')
    }
  }

  const leftStyle: React.CSSProperties =
    position === 'right'
      ? { left: 'auto', right: 0, transform: 'none' }
      : { left: '50%', transform: 'translateX(-50%)' }

  return (
    <div
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        ...leftStyle,
        zIndex: 50,
        minWidth: '240px',
        background: '#fff',
        border: '1px solid #e0dbd5',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: '0.5rem 0',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.5rem 0.75rem 0.5rem',
          fontWeight: 700,
          fontSize: '0.8rem',
          color: '#888',
          borderBottom: '1px solid #f0eeeb',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
        }}
      >
        Добавить в коллекцию
      </div>

      {loading ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: '#aaa', fontSize: '0.85rem' }}>
          Загрузка…
        </div>
      ) : (
        <>
          {/* Legacy "Избранное" */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.88rem',
              color: '#333',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#faf8f5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <input
              type="checkbox"
              checked={isSaved}
              onChange={onToggleSaved}
              style={{ cursor: 'pointer', accentColor: '#c0392b' }}
            />
            <span>❤️ Избранное</span>
          </label>

          {/* Named collections */}
          {collections.map((col) => (
            <label
              key={col.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.88rem',
                color: '#333',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#faf8f5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <input
                type="checkbox"
                checked={inCollections.has(col.id)}
                onChange={() => toggleCollection(col.id)}
                style={{ cursor: 'pointer', accentColor: '#c0392b' }}
              />
              <span>📁 {col.name}</span>
              {col.is_public && (
                <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: 'auto' }}>🌐</span>
              )}
            </label>
          ))}

          {collections.length === 0 && !isSaved && (
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.82rem', color: '#aaa' }}>
              Нет коллекций. Создайте первую ниже.
            </div>
          )}

          {/* Create new collection */}
          <div style={{ borderTop: '1px solid #f0eeeb', marginTop: '0.5rem', padding: '0.5rem 0.75rem 0' }}>
            {creating ? (
              <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Название коллекции"
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  style={{
                    padding: '0.4rem 0.7rem',
                    background: '#c0392b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    opacity: !newName.trim() ? 0.6 : 1,
                  }}
                >
                  Создать
                </button>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                style={{
                  width: '100%',
                  padding: '0.4rem',
                  background: 'transparent',
                  border: '1px dashed #ccc',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  color: '#666',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                }}
              >
                + Новая коллекция
              </button>
            )}
            {createError && (
              <div style={{ color: '#c0392b', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                {createError}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
