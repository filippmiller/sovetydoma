'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ArticleFrontmatter } from '@/lib/articles'
import { getSupabase } from '@/lib/supabase'
import { uploadPhoto, photoPublicUrl, type PhotoRow } from '@/lib/photos'
import AuthModal from '@/components/auth/AuthModal'

interface Props {
  fm: ArticleFrontmatter
}

const PROMPTS: Record<string, string> = {
  kulinaria: 'Приготовили по рецепту?',
  'dom-i-uborka': 'Навели порядок или вывели пятно?',
  'dacha-i-ogorod': 'Вырастили или починили что-то на даче?',
  layfkhaki: 'Попробовали лайфхак?',
  ekonomiya: 'Сэкономили по нашим советам?',
}

/**
 * "Покажите, что получилось": real upload (Supabase Storage) + moderation +
 * approved-photo gallery. Anonymous users are invited to register first.
 */
export default function ArticlePhotoSubmissionCTA({ fm }: Props) {
  const prompt = PROMPTS[fm.category] || 'Получилось по нашим советам?'
  const [gallery, setGallery] = useState<PhotoRow[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showAuth, setShowAuth] = useState(false)

  const loadGallery = useCallback(async () => {
    try {
      const sb = getSupabase()
      const { data } = await sb.from('photos').select('*')
        .eq('article_slug', fm.slug).eq('status', 'approved')
        .order('created_at', { ascending: false })
      setGallery((data as PhotoRow[]) || [])
    } catch { /* offline */ }
  }, [fm.slug])

  useEffect(() => {
    ;(async () => {
      try {
        const sb = getSupabase()
        const { data } = await sb.auth.getUser()
        setUserId(data.user?.id ?? null)
      } catch {}
      loadGallery()
    })()
  }, [fm.slug, loadGallery])

  const submit = async () => {
    if (!userId) { setShowAuth(true); return }
    if (!file) { setError('Выберите фото'); return }
    setError(''); setBusy(true); setResult(null)
    const r = await uploadPhoto({ file, articleSlug: fm.slug, caption })
    setBusy(false)
    if (!r.ok) { setError(r.error === 'not_authenticated' ? 'Войдите, чтобы загрузить фото' : 'Не удалось загрузить фото'); return }
    setFile(null); setCaption('')
    if (r.status === 'approved') { setResult('approved'); loadGallery() }
    else if (r.status === 'rejected') setResult('rejected')
    else setResult('pending')
  }

  return (
    <section
      aria-label="Покажите, что получилось"
      style={{ marginTop: '2rem', background: 'linear-gradient(135deg, #fff7ed 0%, #fdf2f8 100%)', border: '1px dashed #e7c9a8', borderRadius: '12px', padding: '1.4rem 1.25rem' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>📸</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.25rem' }}>Покажите, что получилось</div>
        <p style={{ fontSize: '0.9rem', color: '#7a6f63', margin: '0 0 1rem' }}>{prompt} Поделитесь результатом с другими читателями.</p>
      </div>

      {/* Approved gallery */}
      {gallery.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {gallery.map((p) => (
            <figure key={p.id} style={{ margin: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPublicUrl(p.storage_path)} alt={p.caption || 'Фото результата'} loading="lazy"
                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
              {p.caption && <figcaption style={{ fontSize: '0.72rem', color: '#7a6f63', marginTop: '0.2rem', lineHeight: 1.3 }}>{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {/* Upload form */}
      {result === 'approved' ? (
        <div style={{ textAlign: 'center', color: '#1e8449', fontWeight: 600, fontSize: '0.9rem' }}>✅ Фото опубликовано! Спасибо.</div>
      ) : result === 'pending' ? (
        <div style={{ textAlign: 'center', color: '#b8860b', fontWeight: 600, fontSize: '0.9rem' }}>🕓 Фото отправлено на модерацию и появится после проверки.</div>
      ) : result === 'rejected' ? (
        <div style={{ textAlign: 'center', color: '#c0392b', fontWeight: 600, fontSize: '0.9rem' }}>Фото не прошло автоматическую проверку.</div>
      ) : (
        <div style={{ maxWidth: '460px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ fontSize: '0.85rem', color: '#555' }} />
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} placeholder="Подпись (необязательно)"
            style={{ border: '1.5px solid #e0d3c2', borderRadius: '8px', padding: '0.5rem 0.7rem', fontSize: '0.88rem', fontFamily: 'inherit' }} />
          {error && <p style={{ color: '#c0392b', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
          <button onClick={submit} disabled={busy}
            style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.55rem 1.1rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Загружаем…' : '📷 Добавить фото результата'}
          </button>
        </div>
      )}

      {showAuth && <AuthModal isOpen onClose={() => setShowAuth(false)} initialTab="register" reason="Войдите, чтобы загрузить фото результата." />}
    </section>
  )
}
