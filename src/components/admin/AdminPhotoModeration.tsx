'use client'

import { useEffect, useState } from 'react'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase'
import { photoPublicUrl, type PhotoRow } from '@/lib/photos'

export default function AdminPhotoModeration() {
  const authState = useAdminAuth()
  const [photos, setPhotos] = useState<PhotoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const load = async () => {
    setLoading(true)
    try {
      const sb = getSupabase()
      const { data } = await sb.from('photos').select('*').eq('status', filter).order('created_at', { ascending: false })
      setPhotos((data as PhotoRow[]) || [])
    } catch { /* */ }
    setLoading(false)
  }

  useEffect(() => { if (authState === 'authed') load() }, [authState, filter])

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const sb = getSupabase()
      await sb.from('photos').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id)
      setPhotos((prev) => prev.filter((p) => p.id !== id))
    } catch { /* */ }
  }

  if (authState !== 'authed') return null

  return (
    <AdminShell activeNav="photos">
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>Фото на модерации</h1>
        <p style={{ color: '#888', fontSize: '0.9rem', margin: '0.25rem 0 1.5rem' }}>
          Загруженные читателями фото. AI выносит предварительный вердикт; спорные остаются здесь для ручной проверки.
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {(['pending', 'approved', 'rejected'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.85rem',
                border: filter === f ? '2px solid #c0392b' : '2px solid #e0dbd5',
                background: filter === f ? '#c0392b0f' : '#fff', color: filter === f ? '#c0392b' : '#555',
              }}>
              {f === 'pending' ? 'На проверке' : f === 'approved' ? 'Одобренные' : 'Отклонённые'}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#aaa' }}>Загрузка…</p>
        ) : photos.length === 0 ? (
          <p style={{ color: '#999' }}>Нет фото в этой категории.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {photos.map((p) => (
              <div key={p.id} style={{ background: '#fff', border: '1px solid #e8e4df', borderRadius: '10px', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPublicUrl(p.storage_path)} alt={p.caption || 'Фото'} loading="lazy"
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block', background: '#f4f4f4' }} />
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.82rem', color: '#1a1a1a', fontWeight: 600 }}>{p.caption || '(без подписи)'}</div>
                  <div style={{ fontSize: '0.72rem', color: '#999', margin: '0.25rem 0' }}>
                    {p.article_slug} · {p.author_name}
                  </div>
                  {p.ai_verdict && (
                    <div style={{ fontSize: '0.72rem', color: p.ai_verdict === 'approved' ? '#1e8449' : p.ai_verdict === 'rejected' ? '#c0392b' : '#b8860b', marginBottom: '0.5rem' }}>
                      🤖 AI: {p.ai_verdict} {p.ai_reason ? `— ${p.ai_reason}` : ''}
                    </div>
                  )}
                  {filter === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setStatus(p.id, 'approved')} style={btn('#27ae60')}>Одобрить</button>
                      <button onClick={() => setStatus(p.id, 'rejected')} style={btn('#c0392b')}>Отклонить</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  )
}

function btn(color: string): React.CSSProperties {
  return {
    flex: 1, padding: '0.4rem 0', borderRadius: '7px', border: 'none', cursor: 'pointer',
    background: color, color: '#fff', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'inherit',
  }
}
