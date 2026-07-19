// Cloudflare Worker: sovetydoma-admin-api
//
// Authenticated admin API over the Supabase content_matrix table. Powers the
// admin UI: list/get articles, guarded metadata/body edits (optimistic
// concurrency + idempotency + revision snapshots + audit log), and
// publish/unpublish transitions that mirror scripts/matrix/publish-dynamic.mjs
// semantics (NO-REDEPLOY publishing: DB writes + renderer cache purge only,
// never a site rebuild).
//
// Every request (except CORS preflight and GET /admin/health) requires a
// Supabase admin JWT — see auth.ts. All DB access is PostgREST with the
// service-role key; upstream response bodies are never forwarded (they could
// echo request headers containing keys).

import { buildCors, parseOriginList } from './cors'
import { validateAdmin, type AdminUser } from './auth'
import { sbBase, sbRest, serviceHeaders, escapePostgrestSearch, type SupabaseEnv } from './supabase'
import {
  findIdempotentReplay,
  insertAuditEvent,
  insertRevision,
  insertMatrixEvent,
} from './audit'
import { checkMutationRateLimit } from './rate-limit'
import {
  listMediaInventory,
  getArticleMedia,
  startGeneration,
  uploadMedia,
  assignMedia,
  archiveMedia,
  rollbackMedia,
  getJob,
  retryJob,
  purgeRenderer as purgeRendererDetailed,
  type MediaEnv,
} from './media'

export interface Env extends SupabaseEnv, MediaEnv {
  SUPABASE_ANON_KEY?: string
  ALLOWED_ORIGINS?: string
  RENDERER_URL?: string
  RENDERER_PURGE_SECRET?: string
  SITE_URL?: string
  VERSION?: string
  ARTICLE_IMAGES?: R2Bucket
  FAL_KEY?: string
  FAL_MODEL?: string
  R2_UPLOAD_SECRET?: string
}

const DEFAULT_ORIGINS = 'https://1001sovet.ru,https://www.1001sovet.ru,http://localhost:3000'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// SAFE column subset for the list endpoint — never body_md here.
const LIST_SELECT = 'id,slug,category,title,text_status,disposition,updated_at,created_at,published_at,image_filename,revision_count,quality_score'
const SORTABLE_COLUMNS = new Set(['updated_at', 'created_at', 'published_at', 'title'])
const MAX_PER_PAGE = 100 // PostgREST caps at 1000 rows; keep admin pages small.

// Editable-field allow-list for PATCH /admin/articles/:id.
// NOTE: content_matrix has no image_alt column today (checked against
// supabase/migrations/20260604105305_content_matrix.sql); image_alt is
// accepted only if the column appears on the row (future-proof), else 400.
const EDITABLE_FIELDS = new Set(['title', 'description', 'body_md', 'frontmatter', 'image_alt'])
const SCALAR_EDITABLE = ['title', 'description', 'body_md', 'image_alt'] as const

// Publish guard, mirrors the human/admin-facing transitions (publish-dynamic
// uses 'approved'; admin may also publish drafts and re-publish unpublished).
const PUBLISHABLE_STATUSES = ['approved', 'draft', 'unpublished']

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function json(obj: unknown, status: number, h: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}

function err(h: Record<string, string>, status: number, error: string, message: string): Response {
  return json({ error, message }, status, h)
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowed = parseOriginList(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
  return buildCors(origin, allowed, 'GET, POST, PATCH, OPTIONS', {
    'Access-Control-Allow-Headers': 'authorization, content-type, x-expected-updated-at, idempotency-key',
  })
}

/** Mutating requests from a browser must carry an allowed Origin. */
function originAllowed(req: Request, env: Env): boolean {
  const origin = req.headers.get('Origin')
  if (!origin) return true // non-browser client (curl/server-to-server)
  return parseOriginList(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).includes(origin)
}

async function fetchMatrixRow(env: Env, id: string): Promise<Record<string, unknown> | null | undefined> {
  const res = await sbRest(env, `content_matrix?id=eq.${encodeURIComponent(id)}&select=*`)
  if (!res || !res.ok) return undefined // upstream error
  const rows = await res.json().catch(() => []) as Array<Record<string, unknown>>
  return rows[0] || null
}

async function purgeRenderer(env: Env, category: unknown, slug: unknown): Promise<{ ok: boolean; detail?: string; status?: number }> {
  return purgeRendererDetailed(env, category, slug)
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function listArticles(req: Request, env: Env, h: Record<string, string>): Promise<Response> {
  const sp = new URL(req.url).searchParams
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(sp.get('per_page') || '50', 10) || 50))

  const params = [`select=${LIST_SELECT}`]

  const status = (sp.get('status') || '').trim()
  if (status) {
    if (!/^[a-z_]{1,40}$/.test(status)) return err(h, 400, 'bad_status', 'Invalid status filter')
    params.push(`text_status=eq.${status}`)
  }

  const category = (sp.get('category') || '').trim()
  if (category) {
    if (!/^[a-z0-9-]{1,60}$/i.test(category)) return err(h, 400, 'bad_category', 'Invalid category filter')
    params.push(`category=eq.${encodeURIComponent(category)}`)
  }

  const q = escapePostgrestSearch(sp.get('q') || '')
  if (q) {
    const enc = encodeURIComponent(q)
    params.push(`or=(title.ilike.*${enc}*,slug.ilike.*${enc}*)`)
  }

  // Single `sort=column.direction` param (PostgREST-native, matches the admin
  // client). A bare `column` (no direction) defaults to desc; unknown columns
  // and directions fall back to `updated_at.desc`.
  const [sortColRaw, sortDirRaw = ''] = (sp.get('sort') || 'updated_at.desc').trim().split('.')
  const sortCol = SORTABLE_COLUMNS.has(sortColRaw) ? sortColRaw : 'updated_at'
  const sortDir = sortDirRaw.toLowerCase() === 'asc' ? 'asc' : 'desc'
  params.push(`order=${sortCol}.${sortDir}`)

  const offset = (page - 1) * perPage
  const res = await sbRest(env, `content_matrix?${params.join('&')}`, undefined, {
    'Range-Unit': 'items',
    Range: `${offset}-${offset + perPage - 1}`,
    Prefer: 'count=exact',
  })
  if (!res || !res.ok) return err(h, 502, 'upstream_error', 'Failed to list articles')

  const items = await res.json().catch(() => []) as unknown[]
  const contentRange = res.headers.get('content-range') || '' // e.g. "0-24/137" or "*/0"
  const totalMatch = contentRange.match(/\/(\d+)$/)
  const total = totalMatch ? parseInt(totalMatch[1], 10) : items.length

  return json({ items, page, per_page: perPage, total }, 200, h)
}

async function getArticle(env: Env, h: Record<string, string>, id: string): Promise<Response> {
  const row = await fetchMatrixRow(env, id)
  if (row === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (row === null) return err(h, 404, 'not_found', 'Article not found')
  return json({ item: row }, 200, h)
}

async function patchArticle(req: Request, env: Env, h: Record<string, string>, id: string, actor: AdminUser): Promise<Response> {
  const expected = req.headers.get('X-Expected-Updated-At')
  if (!expected) {
    return err(h, 428, 'precondition_required', 'X-Expected-Updated-At header required (last-seen updated_at)')
  }
  const idemKey = req.headers.get('Idempotency-Key')
  if (!idemKey) return err(h, 400, 'bad_request', 'Idempotency-Key header required')

  // Idempotency replay — checked FIRST, before any mutation.
  const replay = await findIdempotentReplay(env, idemKey)
  if (replay !== null) return json(replay, 200, { ...h, 'Idempotent-Replay': 'true' })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return err(h, 400, 'bad_json', 'JSON object body required')
  }

  const unknownFields = Object.keys(body).filter((k) => !EDITABLE_FIELDS.has(k))
  if (unknownFields.length > 0) {
    return err(h, 400, 'unknown_field', `Unknown field(s): ${unknownFields.join(', ')}`)
  }
  for (const f of SCALAR_EDITABLE) {
    if (f in body && typeof body[f] !== 'string') {
      return err(h, 400, 'bad_type', `Field '${f}' must be a string`)
    }
  }
  if ('frontmatter' in body) {
    const fm = body.frontmatter
    if (typeof fm !== 'object' || fm === null || Array.isArray(fm)) {
      return err(h, 400, 'bad_type', "Field 'frontmatter' must be an object (shallow-merged)")
    }
  }

  const cur = await fetchMatrixRow(env, id)
  if (cur === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (cur === null) return err(h, 404, 'not_found', 'Article not found')

  if ('image_alt' in body && !('image_alt' in cur)) {
    return err(h, 400, 'unknown_field', 'image_alt is not a content_matrix column')
  }

  // Diff: only actually-changed fields are written and audited.
  const update: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const f of SCALAR_EDITABLE) {
    if (f in body && body[f] !== cur[f]) {
      update[f] = body[f]
      before[f] = cur[f] ?? null
      after[f] = body[f]
    }
  }
  if ('frontmatter' in body) {
    const curFm = cur.frontmatter && typeof cur.frontmatter === 'object' && !Array.isArray(cur.frontmatter)
      ? cur.frontmatter as Record<string, unknown>
      : {}
    const merged = { ...curFm, ...(body.frontmatter as Record<string, unknown>) }
    if (JSON.stringify(merged) !== JSON.stringify(curFm)) {
      update.frontmatter = merged
      before.frontmatter = curFm
      after.frontmatter = merged
    }
  }

  if (Object.keys(after).length === 0) {
    return json({ item: cur, unchanged: true }, 200, h)
  }

  const revision = (typeof cur.revision_count === 'number' ? cur.revision_count : 0) + 1
  update.revision_count = revision

  // Optimistic-concurrency guarded write FIRST. Only the writer whose
  // X-Expected-Updated-At still matches wins (the trigger bumps updated_at, so
  // a concurrent editor's guard matches zero rows). Serializing here means the
  // revision snapshot below can never collide on unique(matrix_id, revision).
  const headers = serviceHeaders(env, { Prefer: 'return=representation' })
  if (!headers) return err(h, 503, 'not_configured', 'Database not configured')
  const patchRes = await fetch(
    `${sbBase(env)}/rest/v1/content_matrix?id=eq.${encodeURIComponent(id)}&updated_at=eq.${encodeURIComponent(expected)}`,
    { method: 'PATCH', headers, body: JSON.stringify(update) },
  )
  if (!patchRes.ok) return err(h, 502, 'upstream_error', 'Failed to update article')
  const updated = (await patchRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
  if (!updated) {
    // Guard failed — row changed or disappeared since the client last saw it.
    const exists = await fetch(`${sbBase(env)}/rest/v1/content_matrix?id=eq.${encodeURIComponent(id)}&select=id`, { headers })
    const stillThere = exists.ok && ((await exists.json().catch(() => []) as unknown[]).length > 0)
    if (!stillThere) return err(h, 404, 'not_found', 'Article not found')
    return err(h, 409, 'conflict', 'Row was modified since X-Expected-Updated-At; refetch and retry')
  }

  // Snapshot the pre-write row for the winning writer (rollback-ready).
  // Best-effort: a failed snapshot must not undo an already-committed edit.
  await insertRevision(env, { matrix_id: id, revision, snapshot: cur, actor_id: actor.id })

  const result = { item: updated }
  await insertAuditEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'article.update',
    target_type: 'content_matrix',
    target_id: id,
    before,
    after,
    idempotency_key: idemKey,
    request_id: req.headers.get('cf-ray'),
    result,
  })
  await insertMatrixEvent(env, {
    matrix_id: id,
    axis: 'admin',
    from_value: `fields:${Object.keys(before).join(',')}`,
    to_value: `fields:${Object.keys(after).join(',')}`,
    agent: 'admin-api',
    notes: `article.update by ${actor.email || actor.id}`,
  })

  return json(result, 200, h)
}

async function publishArticle(req: Request, env: Env, h: Record<string, string>, id: string, actor: AdminUser): Promise<Response> {
  const idemKey = req.headers.get('Idempotency-Key')
  if (!idemKey) return err(h, 400, 'bad_request', 'Idempotency-Key header required')

  const replay = await findIdempotentReplay(env, idemKey)
  if (replay !== null) return json(replay, 200, { ...h, 'Idempotent-Replay': 'true' })

  const cur = await fetchMatrixRow(env, id)
  if (cur === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (cur === null) return err(h, 404, 'not_found', 'Article not found')

  // Already published = idempotent 200 (return current state, no mutation).
  if (cur.text_status === 'published') {
    return json({ item: cur, already_published: true }, 200, h)
  }
  if (!PUBLISHABLE_STATUSES.includes(String(cur.text_status))) {
    return err(h, 409, 'conflict', `Cannot publish from status '${String(cur.text_status)}'`)
  }

  // Mirror scripts/matrix/publish-dynamic.mjs DB semantics (NO-REDEPLOY):
  // text_status='published', published_at set once, frontmatter.published_via='dynamic'.
  const now = new Date().toISOString()
  const isRepublish = typeof cur.published_at === 'string' && !!cur.published_at
  const publishedAt = isRepublish ? cur.published_at : now
  const curFm = cur.frontmatter && typeof cur.frontmatter === 'object' && !Array.isArray(cur.frontmatter)
    ? cur.frontmatter as Record<string, unknown>
    : {}
  // First publish stamps today's date (parity with publish-dynamic). Re-publishing
  // a previously-published article preserves its original date instead of stomping it.
  const fm = { ...curFm, published_via: 'dynamic', ...(isRepublish ? {} : { date: now.slice(0, 10) }) }

  const headers = serviceHeaders(env, { Prefer: 'return=representation' })
  if (!headers) return err(h, 503, 'not_configured', 'Database not configured')
  const patchRes = await fetch(
    `${sbBase(env)}/rest/v1/content_matrix?id=eq.${encodeURIComponent(id)}&text_status=in.(${PUBLISHABLE_STATUSES.join(',')})`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ text_status: 'published', published_at: publishedAt, frontmatter: fm }),
    },
  )
  if (!patchRes.ok) return err(h, 502, 'upstream_error', 'Failed to publish article')
  const updated = (await patchRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
  if (!updated) return err(h, 409, 'conflict', 'Status changed concurrently; refetch and retry')

  // Upsert the autopost publication index exactly like publish-dynamic.mjs.
  // Failure is DEGRADED, not fatal: the article is already live.
  const idxHeaders = serviceHeaders(env, { Prefer: 'resolution=merge-duplicates,return=minimal' })
  let indexOk = false
  if (idxHeaders) {
    try {
      const idxRes = await fetch(`${sbBase(env)}/rest/v1/articles_publication_index`, {
        method: 'POST',
        headers: idxHeaders,
        body: JSON.stringify({
          article_slug: cur.slug,
          category_slug: cur.category,
          title: cur.title,
          canonical_path: `/${String(cur.category)}/${String(cur.slug)}/`,
          description: cur.description || '',
          published_at: publishedAt,
        }),
      })
      indexOk = idxRes.ok
    } catch {
      indexOk = false
    }
  }

  await insertMatrixEvent(env, {
    matrix_id: id,
    axis: 'text',
    from_value: String(cur.text_status),
    to_value: 'published',
    agent: 'admin-api',
    notes: 'published-dynamic via admin-api (DB only, no rebuild)',
    payload: { published_via: 'dynamic' },
  })

  // Purge renderer caches; tolerate failure (reported via purge_ok + detail).
  const purge = await purgeRenderer(env, cur.category, cur.slug)

  const result = {
    item: updated,
    index_ok: indexOk,
    purge_ok: purge.ok,
    purge_detail: purge.detail || null,
    purge_status: purge.status || null,
  }
  await insertAuditEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'article.publish',
    target_type: 'content_matrix',
    target_id: id,
    before: { text_status: cur.text_status },
    after: { text_status: 'published', published_at: publishedAt },
    idempotency_key: idemKey,
    request_id: req.headers.get('cf-ray'),
    result,
  })

  return json(result, 200, h)
}

async function unpublishArticle(req: Request, env: Env, h: Record<string, string>, id: string, actor: AdminUser): Promise<Response> {
  const idemKey = req.headers.get('Idempotency-Key')
  if (!idemKey) return err(h, 400, 'bad_request', 'Idempotency-Key header required')

  const replay = await findIdempotentReplay(env, idemKey)
  if (replay !== null) return json(replay, 200, { ...h, 'Idempotent-Replay': 'true' })

  const cur = await fetchMatrixRow(env, id)
  if (cur === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (cur === null) return err(h, 404, 'not_found', 'Article not found')

  // Already unpublished = idempotent 200.
  if (cur.text_status === 'unpublished') {
    return json({ item: cur, already_unpublished: true }, 200, h)
  }
  if (cur.text_status !== 'published') {
    return err(h, 409, 'conflict', `Cannot unpublish from status '${String(cur.text_status)}' (only 'published')`)
  }

  const headers = serviceHeaders(env, { Prefer: 'return=representation' })
  if (!headers) return err(h, 503, 'not_configured', 'Database not configured')
  const patchRes = await fetch(
    `${sbBase(env)}/rest/v1/content_matrix?id=eq.${encodeURIComponent(id)}&text_status=eq.published`,
    { method: 'PATCH', headers, body: JSON.stringify({ text_status: 'unpublished' }) },
  )
  if (!patchRes.ok) return err(h, 502, 'upstream_error', 'Failed to unpublish article')
  const updated = (await patchRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
  if (!updated) return err(h, 409, 'conflict', 'Status changed concurrently; refetch and retry')

  await insertMatrixEvent(env, {
    matrix_id: id,
    axis: 'text',
    from_value: 'published',
    to_value: 'unpublished',
    agent: 'admin-api',
    notes: 'unpublished via admin-api',
  })

  // Purge article + sitemap + hubs (renderer expands the purge set server-side).
  const purge = await purgeRenderer(env, cur.category, cur.slug)

  const result = {
    item: updated,
    purge_ok: purge.ok,
    purge_detail: purge.detail || null,
    purge_status: purge.status || null,
  }
  await insertAuditEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'article.unpublish',
    target_type: 'content_matrix',
    target_id: id,
    before: { text_status: 'published' },
    after: { text_status: 'unpublished' },
    idempotency_key: idemKey,
    request_id: req.headers.get('cf-ray'),
    result,
  })

  return json(result, 200, h)
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const worker = {
  async fetch(req: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const h = corsHeaders(req, env)

    if (req.method === 'OPTIONS') return new Response('ok', { headers: h })

    if (url.pathname === '/admin/health' && req.method === 'GET') {
      return json({
        ok: true,
        version: env.VERSION || 'dev',
        now: new Date().toISOString(),
        media: {
          r2: !!env.ARTICLE_IMAGES,
          fal: !!env.FAL_KEY,
          purge: !!(env.RENDERER_URL && env.RENDERER_PURGE_SECRET),
        },
      }, 200, h)
    }

    if (!url.pathname.startsWith('/admin/')) {
      return err(h, 404, 'not_found', 'Not found')
    }

    // Reject cross-origin mutations before touching auth or the DB.
    if ((req.method === 'POST' || req.method === 'PATCH') && !originAllowed(req, env)) {
      return err(h, 403, 'forbidden_origin', 'Origin not allowed')
    }

    const auth = await validateAdmin(env, req.headers.get('Authorization') || '')
    if (!auth.ok) return err(h, auth.status, auth.error, auth.message)

    if ((req.method === 'POST' || req.method === 'PATCH') && !checkMutationRateLimit(auth.user.id)) {
      return err(h, 429, 'rate_limited', 'Too many mutating requests; slow down')
    }

    // ---- Media inventory & jobs ----
    if (url.pathname === '/admin/media') {
      if (req.method !== 'GET') return err(h, 405, 'method_not_allowed', 'Method not allowed')
      return listMediaInventory(req, env, h)
    }

    const jobMatch = url.pathname.match(/^\/admin\/media\/jobs\/([^/]+)(\/retry)?$/)
    if (jobMatch) {
      const jobId = jobMatch[1]
      const jobAction = jobMatch[2] || ''
      if (!UUID_RE.test(jobId)) return err(h, 400, 'bad_id', 'Invalid job id (uuid expected)')
      if (!jobAction && req.method === 'GET') return getJob(env, h, jobId)
      if (jobAction === '/retry' && req.method === 'POST') return retryJob(req, env, h, jobId, auth.user, ctx)
      return err(h, 405, 'method_not_allowed', 'Method not allowed')
    }

    if (url.pathname === '/admin/articles') {
      if (req.method !== 'GET') return err(h, 405, 'method_not_allowed', 'Method not allowed')
      return listArticles(req, env, h)
    }

    // Article media nested routes
    const mediaMatch = url.pathname.match(
      /^\/admin\/articles\/([^/]+)\/media(?:\/(generations|uploads|([^/]+)\/(assign|apply-and-publish|archive|rollback)))?$/,
    )
    if (mediaMatch) {
      const articleId = mediaMatch[1]
      if (!UUID_RE.test(articleId)) return err(h, 400, 'bad_id', 'Invalid article id (uuid expected)')
      const tail = mediaMatch[2] || ''
      if (!tail && req.method === 'GET') return getArticleMedia(env, h, articleId)
      if (tail === 'generations' && req.method === 'POST') {
        return startGeneration(req, env, h, articleId, auth.user, ctx)
      }
      if (tail === 'uploads' && req.method === 'POST') {
        return uploadMedia(req, env, h, articleId, auth.user)
      }
      const mediaId = mediaMatch[3]
      const mediaAction = mediaMatch[4]
      if (mediaId && mediaAction) {
        if (!UUID_RE.test(mediaId)) return err(h, 400, 'bad_id', 'Invalid media id (uuid expected)')
        if (mediaAction === 'assign' && req.method === 'POST') {
          return assignMedia(req, env, h, articleId, mediaId, auth.user, { publish: false })
        }
        if (mediaAction === 'apply-and-publish' && req.method === 'POST') {
          return assignMedia(req, env, h, articleId, mediaId, auth.user, { publish: true })
        }
        if (mediaAction === 'archive' && req.method === 'POST') {
          return archiveMedia(req, env, h, articleId, mediaId, auth.user)
        }
        if (mediaAction === 'rollback' && req.method === 'POST') {
          return rollbackMedia(req, env, h, articleId, mediaId, auth.user)
        }
      }
      return err(h, 405, 'method_not_allowed', 'Method not allowed')
    }

    const m = url.pathname.match(/^\/admin\/articles\/([^/]+)(\/publish|\/unpublish)?$/)
    if (!m) return err(h, 404, 'not_found', 'Not found')
    const id = m[1]
    const action = m[2] || ''

    if (!UUID_RE.test(id)) return err(h, 400, 'bad_id', 'Invalid article id (uuid expected)')

    if (!action && req.method === 'GET') return getArticle(env, h, id)
    if (!action && req.method === 'PATCH') return patchArticle(req, env, h, id, auth.user)
    if (action === '/publish' && req.method === 'POST') return publishArticle(req, env, h, id, auth.user)
    if (action === '/unpublish' && req.method === 'POST') return unpublishArticle(req, env, h, id, auth.user)

    return err(h, 405, 'method_not_allowed', 'Method not allowed')
  },
}

export default worker
