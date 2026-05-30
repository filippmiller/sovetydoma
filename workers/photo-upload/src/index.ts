// Cloudflare Worker: photo upload + serving backed by R2.
// The static site cannot write to R2 directly, so this Worker:
//   POST /upload     — validates the caller's Supabase JWT, stores the file in
//                      R2, returns { key }.
//   GET  /file/<key> — streams the object back from R2 (R2 is private).

interface Env {
  PHOTOS: R2Bucket
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string // secret via `wrangler secret put`
  ALLOWED_ORIGIN: string
}

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-article-slug, x-file-ext',
  }
}

async function validateUser(env: Env, authHeader: string): Promise<string | null> {
  if (!authHeader) return null
  try {
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: env.SUPABASE_ANON_KEY },
    })
    if (!res.ok) return null
    const u = await res.json()
    return u?.id || null
  } catch {
    return null
  }
}

function json(obj: unknown, status: number, h: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const h = cors(env)
    if (req.method === 'OPTIONS') return new Response('ok', { headers: h })

    if (req.method === 'GET' && url.pathname.startsWith('/file/')) {
      const key = decodeURIComponent(url.pathname.slice('/file/'.length))
      const obj = await env.PHOTOS.get(key)
      if (!obj) return new Response('Not found', { status: 404, headers: h })
      const headers = new Headers(h)
      obj.writeHttpMetadata(headers)
      headers.set('etag', obj.httpEtag)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new Response(obj.body, { headers })
    }

    if (req.method === 'POST' && url.pathname === '/upload') {
      const uid = await validateUser(env, req.headers.get('Authorization') || '')
      if (!uid) return json({ error: 'unauthorized' }, 401, h)

      const articleSlug = (req.headers.get('x-article-slug') || 'misc').replace(/[^a-z0-9-]/g, '')
      const ext = (req.headers.get('x-file-ext') || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const contentType = req.headers.get('content-type') || 'application/octet-stream'
      if (!ALLOWED_TYPES.includes(contentType)) return json({ error: 'bad_type' }, 415, h)

      const body = await req.arrayBuffer()
      if (body.byteLength === 0) return json({ error: 'empty' }, 400, h)
      if (body.byteLength > MAX_BYTES) return json({ error: 'too_large' }, 413, h)

      const key = `${articleSlug}/${uid}-${Date.now()}.${ext}`
      await env.PHOTOS.put(key, body, { httpMetadata: { contentType } })
      return json({ key }, 200, h)
    }

    return new Response('Not found', { status: 404, headers: h })
  },
}
