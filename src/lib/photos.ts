import { getSupabase } from '@/lib/supabase'

export interface PhotoRow {
  id: string
  article_slug: string
  storage_path: string
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

/** Public URL for a photo stored in the 'photos' bucket. */
export function photoPublicUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${storagePath}`
}

/**
 * Upload a file to the 'photos' bucket, create the metadata row (pending),
 * then trigger AI moderation. Returns the created row (with post-AI status).
 */
export async function uploadPhoto(opts: {
  file: File
  articleSlug: string
  caption: string
}): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const sb = getSupabase()
  const { data: u } = await sb.auth.getUser()
  if (!u.user) return { ok: false, error: 'not_authenticated' }

  const ext = (opts.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${opts.articleSlug}/${u.user.id}-${Date.now()}.${ext}`

  const up = await sb.storage.from('photos').upload(path, opts.file, {
    contentType: opts.file.type, upsert: false,
  })
  if (up.error) return { ok: false, error: up.error.message }

  const { data: row, error: insErr } = await sb.from('photos').insert({
    article_slug: opts.articleSlug,
    storage_path: path,
    caption: opts.caption.trim(),
    user_id: u.user.id,
    author_name: u.user.email?.split('@')[0] || 'Пользователь',
    status: 'pending',
  }).select().single()
  if (insErr || !row) return { ok: false, error: insErr?.message || 'insert_failed' }

  // Fire AI moderation (best-effort; if it fails the photo stays pending).
  let status = 'pending'
  try {
    const { data: sess } = await sb.auth.getSession()
    const token = sess.session?.access_token
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
