import { getSupabase } from '@/lib/supabase'

export interface PhotoRow {
  id: string
  article_slug: string
  storage_path: string   // R2 object key (served via the upload Worker)
  caption: string
  user_id: string | null
  author_name: string
  status: 'pending' | 'approved' | 'rejected'
  ai_verdict: string | null
  ai_reason: string
  created_at: string
  reviewed_at: string | null
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
// Cloudflare Worker that stores/serves photos in R2.
const PHOTO_WORKER = (process.env.NEXT_PUBLIC_PHOTO_WORKER_URL || 'https://sovetydoma-photo-upload.filippmiller.workers.dev').replace(/\/+$/, '')

/** Public URL for a photo stored in R2 (served by the upload Worker). */
export function photoPublicUrl(storagePath: string): string {
  return `${PHOTO_WORKER}/file/${storagePath.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * Upload raw bytes to R2 via the Worker and return the object key. Lower-level
 * than uploadPhoto() — used where the caller stores the key in its own table
 * (e.g. an optional photo attached to a comment).
 */
export async function uploadToR2(opts: {
  file: File
  articleSlug: string
}): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const sb = getSupabase()
  const { data: sess } = await sb.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return { ok: false, error: 'not_authenticated' }
  const ext = (opts.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  try {
    const up = await fetch(`${PHOTO_WORKER}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': opts.file.type || 'image/jpeg',
        'x-article-slug': opts.articleSlug,
        'x-file-ext': ext,
      },
      body: opts.file,
    })
    const j = await up.json()
    if (!up.ok || !j?.key) return { ok: false, error: j?.error || 'upload_failed' }
    return { ok: true, key: j.key }
  } catch {
    return { ok: false, error: 'upload_failed' }
  }
}

/**
 * Upload a file to R2 via the Worker, create the metadata row (pending), then
 * trigger automated moderation. Returns the resulting moderation status.
 */
export async function uploadPhoto(opts: {
  file: File
  articleSlug: string
  caption: string
}): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const sb = getSupabase()
  const { data: u } = await sb.auth.getUser()
  if (!u.user) return { ok: false, error: 'not_authenticated' }

  const { data: sess } = await sb.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return { ok: false, error: 'not_authenticated' }

  const ext = (opts.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')

  // 1) Upload bytes to R2 through the Worker (validates the JWT, returns key).
  let key: string
  try {
    const up = await fetch(`${PHOTO_WORKER}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': opts.file.type || 'image/jpeg',
        'x-article-slug': opts.articleSlug,
        'x-file-ext': ext,
      },
      body: opts.file,
    })
    const j = await up.json()
    if (!up.ok || !j?.key) return { ok: false, error: j?.error || 'upload_failed' }
    key = j.key
  } catch {
    return { ok: false, error: 'upload_failed' }
  }

  // 2) Record metadata (pending) in Supabase.
  const { data: row, error: insErr } = await sb.from('photos').insert({
    article_slug: opts.articleSlug,
    storage_path: key,
    caption: opts.caption.trim(),
    user_id: u.user.id,
    author_name: u.user.email?.split('@')[0] || 'Пользователь',
    status: 'pending',
  }).select().single()
  if (insErr || !row) return { ok: false, error: insErr?.message || 'insert_failed' }

  // 3) Fire automated moderation (best-effort; on failure the photo stays pending).
  let status = 'pending'
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/moderate-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoId: row.id }),
    })
    const j = await res.json()
    if (j?.status) status = j.status
  } catch { /* moderation deferred to human */ }

  return { ok: true, status }
}
