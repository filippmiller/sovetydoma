/**
 * Article media control plane — list / generate / upload / assign / archive /
 * rollback / jobs. Privileged writes only; R2 keys are immutable; live objects
 * are never physically deleted from this path.
 */

import type { AdminUser } from './auth'
import {
  findIdempotentReplay,
  insertAuditEvent,
  insertMatrixEvent,
  insertRevision,
} from './audit'
import { sbBase, sbRest, serviceHeaders, escapePostgrestSearch, type SupabaseEnv } from './supabase'
import {
  buildImagePrompt,
  defaultNegativePrompt,
  makeStorageKey,
  publicImageUrl,
} from './media-prompt'

export interface MediaEnv extends SupabaseEnv {
  ARTICLE_IMAGES?: R2Bucket
  FAL_KEY?: string
  FAL_MODEL?: string
  RENDERER_URL?: string
  RENDERER_PURGE_SECRET?: string
  SITE_URL?: string
  R2_UPLOAD_SECRET?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MEDIA_LIST_LIMIT = 40
const FAL_DEFAULT_MODEL = 'fal-ai/flux/schnell'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

type JsonH = Record<string, string>

function json(obj: unknown, status: number, h: JsonH): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...h, 'Content-Type': 'application/json' } })
}

function err(h: JsonH, status: number, error: string, message: string): Response {
  return json({ error, message }, status, h)
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSalt(): string {
  const arr = new Uint8Array(6)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function purgeRenderer(env: MediaEnv, category: unknown, slug: unknown): Promise<{
  ok: boolean
  status?: number
  detail?: string
}> {
  if (!env.RENDERER_URL || !env.RENDERER_PURGE_SECRET) {
    return { ok: false, detail: 'purge_not_configured' }
  }
  try {
    const res = await fetch(`${env.RENDERER_URL.replace(/\/+$/, '')}/__purge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-purge-secret': env.RENDERER_PURGE_SECRET },
      body: JSON.stringify({ category, slug }),
    })
    if (res.ok) return { ok: true, status: res.status }
    const body = await res.text().catch(() => '')
    return { ok: false, status: res.status, detail: body.slice(0, 200) || res.statusText }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'fetch_failed' }
  }
}

async function fetchMatrixRow(env: MediaEnv, id: string): Promise<Record<string, unknown> | null | undefined> {
  const res = await sbRest(env, `content_matrix?id=eq.${encodeURIComponent(id)}&select=*`)
  if (!res || !res.ok) return undefined
  const rows = await res.json().catch(() => []) as Array<Record<string, unknown>>
  return rows[0] || null
}

async function nextMediaVersion(env: MediaEnv, articleId: string): Promise<number> {
  const res = await sbRest(
    env,
    `article_media?article_id=eq.${encodeURIComponent(articleId)}&select=version&order=version.desc&limit=1`,
  )
  if (!res || !res.ok) return 1
  const rows = await res.json().catch(() => []) as Array<{ version?: number }>
  const v = rows[0]?.version
  return typeof v === 'number' ? v + 1 : 1
}

async function putR2(env: MediaEnv, key: string, bytes: ArrayBuffer, mime: string): Promise<boolean> {
  if (env.ARTICLE_IMAGES) {
    await env.ARTICLE_IMAGES.put(key, bytes, {
      httpMetadata: {
        contentType: mime || 'image/jpeg',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    })
    return true
  }
  // Fallback: renderer secret upload path (same bucket).
  if (!env.RENDERER_URL || !env.R2_UPLOAD_SECRET) return false
  const res = await fetch(`${env.RENDERER_URL.replace(/\/+$/, '')}/__r2/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      'content-type': mime || 'image/jpeg',
      'x-r2-secret': env.R2_UPLOAD_SECRET,
    },
    body: bytes,
  })
  return res.ok
}

async function insertMediaEvent(
  env: MediaEnv,
  row: {
    actor_id: string | null
    actor_email: string | null
    action: string
    article_id: string
    media_id?: string | null
    job_id?: string | null
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
    idempotency_key?: string | null
  },
): Promise<void> {
  try {
    await sbRest(env, 'article_media_events', { method: 'POST', body: row }, { Prefer: 'return=minimal' })
  } catch {
    // best-effort
  }
}

async function listMediaForArticle(env: MediaEnv, articleId: string): Promise<Record<string, unknown>[]> {
  const res = await sbRest(
    env,
    `article_media?article_id=eq.${encodeURIComponent(articleId)}&select=*&order=version.desc`,
  )
  if (!res || !res.ok) return []
  return await res.json().catch(() => []) as Record<string, unknown>[]
}

function synthesizeLegacyMedia(article: Record<string, unknown>, siteUrl: string): Record<string, unknown> | null {
  const key = typeof article.image_filename === 'string' ? article.image_filename : null
  if (!key) return null
  return {
    id: null,
    article_id: article.id,
    version: 0,
    storage_key: key,
    preview_key: `previews/${String(article.slug)}.jpg`,
    mime: key.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
    width: null,
    height: null,
    sha256: null,
    source: 'legacy',
    provider: article.image_source || null,
    prompt: article.image_prompt || null,
    negative_prompt: null,
    alt: article.title || null,
    status: 'live',
    parent_media_id: null,
    generation_job_id: null,
    created_by: null,
    created_at: article.image_generated_at || article.updated_at || null,
    activated_at: article.published_at || article.updated_at || null,
    retired_at: null,
    public_url: publicImageUrl(siteUrl, key),
    synthetic: true,
  }
}

function mediaPublic(env: MediaEnv, row: Record<string, unknown>): Record<string, unknown> {
  const key = String(row.storage_key || '')
  return {
    ...row,
    public_url: key ? publicImageUrl(env.SITE_URL || 'https://1001sovet.ru', key) : null,
  }
}

// ---------------------------------------------------------------------------
// GET /admin/media — cursor inventory of articles + hero summary
// ---------------------------------------------------------------------------

export async function listMediaInventory(req: Request, env: MediaEnv, h: JsonH): Promise<Response> {
  const sp = new URL(req.url).searchParams
  const limit = Math.min(MEDIA_LIST_LIMIT, Math.max(1, parseInt(sp.get('limit') || '30', 10) || 30))
  const cursor = (sp.get('cursor') || '').trim()
  const category = (sp.get('category') || '').trim()
  const status = (sp.get('status') || '').trim() // article text_status OR media status filter
  const source = (sp.get('source') || '').trim()
  const q = escapePostgrestSearch(sp.get('q') || '')

  const params = [
    'select=id,slug,category,title,text_status,disposition,updated_at,created_at,published_at,image_filename,image_prompt,image_source,image_model,image_status,image_url,image_meta,active_media_id,revision_count',
  ]

  if (category) {
    if (!/^[a-z0-9-]{1,60}$/i.test(category)) return err(h, 400, 'bad_category', 'Invalid category filter')
    params.push(`category=eq.${encodeURIComponent(category)}`)
  }
  if (status && /^[a-z_]{1,40}$/.test(status) && !['live', 'candidate', 'generating', 'failed', 'rejected', 'archived'].includes(status)) {
    params.push(`text_status=eq.${status}`)
  }
  if (q) {
    const enc = encodeURIComponent(q)
    params.push(`or=(title.ilike.*${enc}*,slug.ilike.*${enc}*)`)
  }
  if (source) {
    if (!/^[a-z0-9_:-]{1,40}$/i.test(source)) return err(h, 400, 'bad_source', 'Invalid source filter')
    params.push(`image_source=eq.${encodeURIComponent(source)}`)
  }

  // Cursor: base64url of "updated_at|id" (desc).
  if (cursor) {
    try {
      const decoded = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'))
      const [cAt, cId] = decoded.split('|')
      if (cAt && cId && UUID_RE.test(cId)) {
        // (updated_at, id) < (cAt, cId) under desc order
        params.push(
          `or=(updated_at.lt.${encodeURIComponent(cAt)},and(updated_at.eq.${encodeURIComponent(cAt)},id.lt.${encodeURIComponent(cId)}))`,
        )
      }
    } catch {
      return err(h, 400, 'bad_cursor', 'Invalid cursor')
    }
  }

  params.push('order=updated_at.desc,id.desc')
  params.push(`limit=${limit + 1}`) // one extra to detect has_more

  const res = await sbRest(env, `content_matrix?${params.join('&')}`)
  if (!res || !res.ok) return err(h, 502, 'upstream_error', 'Failed to list media inventory')

  const rows = await res.json().catch(() => []) as Array<Record<string, unknown>>
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  // Batch-fetch non-legacy media for these articles.
  const ids = page.map((r) => String(r.id)).filter((id) => UUID_RE.test(id))
  const mediaByArticle = new Map<string, Record<string, unknown>[]>()
  if (ids.length) {
    const mediaRes = await sbRest(
      env,
      `article_media?article_id=in.(${ids.join(',')})&select=*&order=version.desc`,
    )
    if (mediaRes && mediaRes.ok) {
      const mediaRows = await mediaRes.json().catch(() => []) as Array<Record<string, unknown>>
      for (const m of mediaRows) {
        const aid = String(m.article_id)
        const list = mediaByArticle.get(aid) || []
        list.push(mediaPublic(env, m))
        mediaByArticle.set(aid, list)
      }
    }
  }

  // Optional media-status filter (client-side on this page).
  const mediaStatusFilter = ['live', 'candidate', 'generating', 'failed', 'rejected', 'archived'].includes(status)
    ? status
    : ''

  const site = env.SITE_URL || 'https://1001sovet.ru'
  const items = page
    .map((article) => {
      const versions = mediaByArticle.get(String(article.id)) || []
      const live = versions.find((v) => v.status === 'live') || synthesizeLegacyMedia(article, site)
      const candidates = versions.filter((v) => v.status === 'candidate')
      const generating = versions.some((v) => v.status === 'generating')
      const failed = versions.filter((v) => v.status === 'failed')
      let media_status = 'none'
      if (generating) media_status = 'generating'
      else if (live) media_status = 'live'
      else if (candidates.length) media_status = 'candidate'
      else if (failed.length) media_status = 'failed'
      return {
        article: {
          id: article.id,
          slug: article.slug,
          category: article.category,
          title: article.title,
          text_status: article.text_status,
          disposition: article.disposition,
          updated_at: article.updated_at,
          published_at: article.published_at,
          image_filename: article.image_filename,
          image_prompt: article.image_prompt,
          image_source: article.image_source,
          image_model: article.image_model,
          image_status: article.image_status,
          active_media_id: article.active_media_id,
          revision_count: article.revision_count,
        },
        media_status,
        live: live ? mediaPublic(env, live as Record<string, unknown>) : null,
        candidates,
        versions: versions.length ? versions : live ? [live] : [],
        public_image_url: live
          ? publicImageUrl(site, String((live as Record<string, unknown>).storage_key || article.image_filename || ''))
          : article.image_filename
            ? publicImageUrl(site, String(article.image_filename))
            : null,
      }
    })
    .filter((it) => !mediaStatusFilter || it.media_status === mediaStatusFilter || it.versions.some((v) => v.status === mediaStatusFilter))

  let nextCursor: string | null = null
  if (hasMore && page.length) {
    const last = page[page.length - 1]
    const raw = `${String(last.updated_at)}|${String(last.id)}`
    nextCursor = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  return json({ items, next_cursor: nextCursor, limit }, 200, h)
}

// ---------------------------------------------------------------------------
// GET /admin/articles/:id/media
// ---------------------------------------------------------------------------

export async function getArticleMedia(env: MediaEnv, h: JsonH, articleId: string): Promise<Response> {
  const article = await fetchMatrixRow(env, articleId)
  if (article === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (article === null) return err(h, 404, 'not_found', 'Article not found')

  const versions = (await listMediaForArticle(env, articleId)).map((m) => mediaPublic(env, m))
  const site = env.SITE_URL || 'https://1001sovet.ru'
  const live = versions.find((v) => v.status === 'live') || synthesizeLegacyMedia(article, site)
  const jobsRes = await sbRest(
    env,
    `media_generation_jobs?article_id=eq.${encodeURIComponent(articleId)}&select=*&order=created_at.desc&limit=10`,
  )
  const jobs = jobsRes && jobsRes.ok
    ? await jobsRes.json().catch(() => []) as unknown[]
    : []

  return json({
    article: {
      id: article.id,
      slug: article.slug,
      category: article.category,
      title: article.title,
      text_status: article.text_status,
      updated_at: article.updated_at,
      image_filename: article.image_filename,
      image_prompt: article.image_prompt,
      image_source: article.image_source,
      active_media_id: article.active_media_id,
    },
    live,
    versions: versions.length ? versions : live ? [live] : [],
    jobs,
  }, 200, h)
}

// ---------------------------------------------------------------------------
// fal.ai generation
// ---------------------------------------------------------------------------

async function falGenerateOne(
  env: MediaEnv,
  prompt: string,
  attempt = 1,
): Promise<{ bytes: ArrayBuffer; mime: string; width: number; height: number }> {
  const key = env.FAL_KEY
  if (!key) throw Object.assign(new Error('FAL_KEY not configured'), { code: 'provider_not_configured' })
  const model = env.FAL_MODEL || FAL_DEFAULT_MODEL
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1280, height: 960 },
      num_images: 1,
      num_inference_steps: 4,
      enable_safety_checker: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    if ((res.status === 429 || res.status >= 500) && attempt <= 3) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      return falGenerateOne(env, prompt, attempt + 1)
    }
    throw Object.assign(new Error(`fal ${res.status}: ${body.slice(0, 200)}`), {
      code: res.status === 429 ? 'provider_rate_limited' : 'provider_error',
      retryable: res.status === 429 || res.status >= 500,
    })
  }
  const data = await res.json() as { images?: Array<{ url?: string; width?: number; height?: number }> }
  const url = data?.images?.[0]?.url
  if (!url) throw Object.assign(new Error('fal returned no image url'), { code: 'provider_empty' })
  let bytes: ArrayBuffer
  if (url.startsWith('data:')) {
    const b64 = url.slice(url.indexOf(',') + 1)
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    bytes = arr.buffer
  } else {
    const img = await fetch(url)
    if (!img.ok) throw Object.assign(new Error(`download ${img.status}`), { code: 'provider_download_failed' })
    bytes = await img.arrayBuffer()
  }
  if (bytes.byteLength < 5000) {
    throw Object.assign(new Error('image too small'), { code: 'provider_empty' })
  }
  return {
    bytes,
    mime: 'image/jpeg',
    width: data.images?.[0]?.width || 1280,
    height: data.images?.[0]?.height || 960,
  }
}

async function patchJob(env: MediaEnv, jobId: string, patch: Record<string, unknown>): Promise<void> {
  const headers = serviceHeaders(env, { Prefer: 'return=minimal' })
  if (!headers) return
  await fetch(`${sbBase(env)}/rest/v1/media_generation_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  })
}

export async function runGenerationJob(env: MediaEnv, jobId: string): Promise<void> {
  const jobRes = await sbRest(env, `media_generation_jobs?id=eq.${encodeURIComponent(jobId)}&select=*`)
  if (!jobRes || !jobRes.ok) return
  const jobs = await jobRes.json().catch(() => []) as Array<Record<string, unknown>>
  const job = jobs[0]
  if (!job) return
  if (job.status === 'succeeded' || job.status === 'cancelled') return

  const articleId = String(job.article_id)
  const article = await fetchMatrixRow(env, articleId)
  if (!article) {
    await patchJob(env, jobId, {
      status: 'failed',
      error_code: 'article_missing',
      error_message: 'Article not found',
      retryable: false,
      finished_at: new Date().toISOString(),
    })
    return
  }

  const attempt = (typeof job.attempt === 'number' ? job.attempt : 0) + 1
  await patchJob(env, jobId, {
    status: 'running',
    attempt,
    started_at: new Date().toISOString(),
    progress: 5,
    error_code: null,
    error_message: null,
  })

  const count = Math.min(4, Math.max(1, typeof job.candidate_count === 'number' ? job.candidate_count : 2))
  const prompt = String(job.prompt || '')
  const mediaIds: string[] = []
  let cost = 0

  try {
    for (let i = 0; i < count; i++) {
      const gen = await falGenerateOne(env, prompt)
      cost += 0.003
      const version = await nextMediaVersion(env, articleId)
      const storageKey = makeStorageKey(String(article.slug), version, randomSalt())
      const ok = await putR2(env, storageKey, gen.bytes, gen.mime)
      if (!ok) throw Object.assign(new Error('R2 upload failed'), { code: 'r2_upload_failed', retryable: true })
      const hash = await sha256Hex(gen.bytes)
      const headers = serviceHeaders(env, { Prefer: 'return=representation' })
      if (!headers) throw Object.assign(new Error('db not configured'), { code: 'not_configured' })
      const insertRes = await fetch(`${sbBase(env)}/rest/v1/article_media`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          article_id: articleId,
          version,
          storage_key: storageKey,
          mime: gen.mime,
          width: gen.width,
          height: gen.height,
          sha256: hash,
          source: 'generated',
          provider: env.FAL_MODEL || FAL_DEFAULT_MODEL,
          prompt,
          negative_prompt: job.negative_prompt || null,
          alt: article.title || null,
          status: 'candidate',
          generation_job_id: jobId,
          created_by: job.created_by || null,
        }),
      })
      if (!insertRes.ok) {
        throw Object.assign(new Error('failed to insert article_media'), { code: 'db_insert_failed', retryable: true })
      }
      const inserted = (await insertRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
      if (inserted?.id) mediaIds.push(String(inserted.id))
      await patchJob(env, jobId, {
        progress: Math.round(((i + 1) / count) * 90),
        media_ids: mediaIds,
        cost_usd: cost,
      })
    }

    await patchJob(env, jobId, {
      status: 'succeeded',
      progress: 100,
      media_ids: mediaIds,
      cost_usd: cost,
      cost_meta: { provider: 'fal', model: env.FAL_MODEL || FAL_DEFAULT_MODEL, candidates: mediaIds.length },
      finished_at: new Date().toISOString(),
      retryable: false,
    })

    // Touch article image_prompt so inventory stays useful.
    const headers = serviceHeaders(env, { Prefer: 'return=minimal' })
    if (headers && prompt) {
      await fetch(`${sbBase(env)}/rest/v1/content_matrix?id=eq.${encodeURIComponent(articleId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ image_prompt: prompt, image_status: 'generated' }),
      })
    }
  } catch (e) {
    const code = (e as { code?: string }).code || 'generation_failed'
    const retryable = (e as { retryable?: boolean }).retryable !== false
    await patchJob(env, jobId, {
      status: 'failed',
      error_code: code,
      error_message: e instanceof Error ? e.message.slice(0, 500) : 'unknown',
      retryable,
      finished_at: new Date().toISOString(),
      media_ids: mediaIds,
      cost_usd: cost,
    })
  }
}

// ---------------------------------------------------------------------------
// POST /admin/articles/:id/media/generations
// ---------------------------------------------------------------------------

export async function startGeneration(
  req: Request,
  env: MediaEnv,
  h: JsonH,
  articleId: string,
  actor: AdminUser,
  ctx?: ExecutionContext,
): Promise<Response> {
  const idemKey = req.headers.get('Idempotency-Key')
  if (!idemKey) return err(h, 400, 'bad_request', 'Idempotency-Key header required')

  const replay = await findIdempotentReplay(env, idemKey)
  if (replay !== null) return json(replay, 200, { ...h, 'Idempotent-Replay': 'true' })

  if (!env.FAL_KEY) {
    return err(h, 503, 'provider_not_configured', 'FAL_KEY is not configured on admin-api')
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const article = await fetchMatrixRow(env, articleId)
  if (article === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (article === null) return err(h, 404, 'not_found', 'Article not found')

  const presets = Array.isArray(body.presets)
    ? (body.presets as unknown[]).map(String).filter((p) => /^[a-z0-9_]{1,40}$/i.test(p))
    : []
  const rawPrompt = typeof body.prompt === 'string' && body.prompt.trim()
    ? body.prompt.trim()
    : String(article.image_prompt || article.title || '')
  const prompt = buildImagePrompt(rawPrompt, article.title, article.category, presets)
  const negative = typeof body.negative_prompt === 'string' && body.negative_prompt.trim()
    ? body.negative_prompt.trim()
    : defaultNegativePrompt(presets)
  const count = Math.min(4, Math.max(1, typeof body.count === 'number' ? body.count : 2))

  const headers = serviceHeaders(env, { Prefer: 'return=representation' })
  if (!headers) return err(h, 503, 'not_configured', 'Database not configured')

  const insertRes = await fetch(`${sbBase(env)}/rest/v1/media_generation_jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      article_id: articleId,
      status: 'queued',
      provider: 'fal',
      model: env.FAL_MODEL || FAL_DEFAULT_MODEL,
      prompt,
      negative_prompt: negative,
      candidate_count: count,
      progress: 0,
      attempt: 0,
      created_by: actor.id,
      idempotency_key: idemKey,
    }),
  })
  if (!insertRes.ok) {
    // Unique idempotency race → try replay again
    const again = await findIdempotentReplay(env, idemKey)
    if (again !== null) return json(again, 200, { ...h, 'Idempotent-Replay': 'true' })
    return err(h, 502, 'upstream_error', 'Failed to create generation job')
  }
  const job = (await insertRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
  if (!job?.id) return err(h, 502, 'upstream_error', 'Failed to create generation job')

  const result = { job }
  await insertAuditEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'media.generate',
    target_type: 'media',
    target_id: String(job.id),
    before: {},
    after: { article_id: articleId, prompt, count },
    idempotency_key: idemKey,
    request_id: req.headers.get('cf-ray'),
    result,
  })
  await insertMediaEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'media.generate',
    article_id: articleId,
    job_id: String(job.id),
    after: { prompt, count },
    idempotency_key: idemKey,
  })

  // Only schedule async work when the Workers runtime provides waitUntil.
  // Unit tests call fetch without ExecutionContext — job stays queued until
  // POST /admin/media/jobs/:id/retry (or a real Worker invocation).
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(runGenerationJob(env, String(job.id)))
  }

  return json(result, 202, h)
}

// ---------------------------------------------------------------------------
// POST upload
// ---------------------------------------------------------------------------

export async function uploadMedia(
  req: Request,
  env: MediaEnv,
  h: JsonH,
  articleId: string,
  actor: AdminUser,
): Promise<Response> {
  const idemKey = req.headers.get('Idempotency-Key')
  if (!idemKey) return err(h, 400, 'bad_request', 'Idempotency-Key header required')
  const replay = await findIdempotentReplay(env, idemKey)
  if (replay !== null) return json(replay, 200, { ...h, 'Idempotent-Replay': 'true' })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.data_base64 !== 'string') {
    return err(h, 400, 'bad_json', 'JSON body with data_base64 required')
  }
  const mime = typeof body.mime === 'string' && /^image\/(jpeg|jpg|png|webp)$/i.test(body.mime)
    ? body.mime.toLowerCase().replace('image/jpg', 'image/jpeg')
    : 'image/jpeg'
  let bytes: ArrayBuffer
  try {
    const bin = atob(body.data_base64.replace(/^data:image\/\w+;base64,/, ''))
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    bytes = arr.buffer
  } catch {
    return err(h, 400, 'bad_base64', 'Invalid base64 image data')
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    return err(h, 400, 'bad_size', `Image must be 1..${MAX_UPLOAD_BYTES} bytes`)
  }

  const article = await fetchMatrixRow(env, articleId)
  if (article === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (article === null) return err(h, 404, 'not_found', 'Article not found')

  const version = await nextMediaVersion(env, articleId)
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'
  const storageKey = makeStorageKey(String(article.slug), version, randomSalt()).replace(/\.jpg$/, `.${ext}`)
  const ok = await putR2(env, storageKey, bytes, mime)
  if (!ok) return err(h, 503, 'r2_unavailable', 'Cannot write to R2 (bind ARTICLE_IMAGES or set R2_UPLOAD_SECRET)')

  const hash = await sha256Hex(bytes)
  const headers = serviceHeaders(env, { Prefer: 'return=representation' })
  if (!headers) return err(h, 503, 'not_configured', 'Database not configured')
  const insertRes = await fetch(`${sbBase(env)}/rest/v1/article_media`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      article_id: articleId,
      version,
      storage_key: storageKey,
      mime,
      sha256: hash,
      source: 'upload',
      provider: 'manual',
      prompt: typeof body.prompt === 'string' ? body.prompt.slice(0, 2000) : null,
      alt: typeof body.alt === 'string' ? body.alt.slice(0, 500) : (article.title || null),
      status: 'candidate',
      created_by: actor.id,
    }),
  })
  if (!insertRes.ok) return err(h, 502, 'upstream_error', 'Failed to insert media row')
  const media = (await insertRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
  const result = { media: mediaPublic(env, media) }
  await insertAuditEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'media.upload',
    target_type: 'media',
    target_id: String(media?.id || storageKey),
    before: {},
    after: { storage_key: storageKey, version },
    idempotency_key: idemKey,
    request_id: req.headers.get('cf-ray'),
    result,
  })
  await insertMediaEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'media.upload',
    article_id: articleId,
    media_id: media?.id ? String(media.id) : null,
    after: { storage_key: storageKey },
    idempotency_key: idemKey,
  })
  return json(result, 201, h)
}

// ---------------------------------------------------------------------------
// assign / apply-and-publish / archive / rollback
// ---------------------------------------------------------------------------

async function setLiveMedia(
  env: MediaEnv,
  article: Record<string, unknown>,
  media: Record<string, unknown>,
  actor: AdminUser,
  expectedUpdatedAt: string | null,
): Promise<{ ok: true; article: Record<string, unknown>; media: Record<string, unknown>; purge?: { ok: boolean; detail?: string } } | { ok: false; status: number; error: string; message: string }> {
  const articleId = String(article.id)
  const mediaId = String(media.id)
  const headers = serviceHeaders(env, { Prefer: 'return=representation' })
  if (!headers) return { ok: false, status: 503, error: 'not_configured', message: 'Database not configured' }

  // Retire current live versions (DB rows only — R2 objects stay).
  await fetch(
    `${sbBase(env)}/rest/v1/article_media?article_id=eq.${encodeURIComponent(articleId)}&status=eq.live`,
    {
      method: 'PATCH',
      headers: serviceHeaders(env, { Prefer: 'return=minimal' })!,
      body: JSON.stringify({ status: 'archived', retired_at: new Date().toISOString() }),
    },
  )

  const activateRes = await fetch(
    `${sbBase(env)}/rest/v1/article_media?id=eq.${encodeURIComponent(mediaId)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'live',
        activated_at: new Date().toISOString(),
        retired_at: null,
      }),
    },
  )
  if (!activateRes.ok) return { ok: false, status: 502, error: 'upstream_error', message: 'Failed to activate media' }
  const activated = (await activateRes.json().catch(() => []) as Array<Record<string, unknown>>)[0] || media

  const storageKey = String(activated.storage_key || media.storage_key)
  const site = env.SITE_URL || 'https://1001sovet.ru'
  const revision = (typeof article.revision_count === 'number' ? article.revision_count : 0) + 1
  const update: Record<string, unknown> = {
    image_filename: storageKey,
    image_url: publicImageUrl(site, storageKey),
    image_status: 'approved',
    image_source: activated.source || 'generated',
    image_model: activated.provider || null,
    active_media_id: mediaId,
    revision_count: revision,
  }
  if (activated.prompt) update.image_prompt = activated.prompt

  let patchUrl = `${sbBase(env)}/rest/v1/content_matrix?id=eq.${encodeURIComponent(articleId)}`
  if (expectedUpdatedAt) {
    patchUrl += `&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`
  }
  const patchRes = await fetch(patchUrl, { method: 'PATCH', headers, body: JSON.stringify(update) })
  if (!patchRes.ok) return { ok: false, status: 502, error: 'upstream_error', message: 'Failed to update article image' }
  const updated = (await patchRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
  if (!updated) {
    return { ok: false, status: 409, error: 'conflict', message: 'Row was modified; refetch and retry' }
  }

  await insertRevision(env, {
    matrix_id: articleId,
    revision,
    snapshot: article,
    actor_id: actor.id,
  })
  await insertMatrixEvent(env, {
    matrix_id: articleId,
    axis: 'image',
    from_value: String(article.image_filename || ''),
    to_value: storageKey,
    agent: 'admin-api',
    notes: `media.assign ${mediaId} by ${actor.email || actor.id}`,
  })

  let purge: { ok: boolean; detail?: string } | undefined
  if (updated.text_status === 'published') {
    purge = await purgeRenderer(env, updated.category, updated.slug)
  }

  return { ok: true, article: updated, media: mediaPublic(env, activated), purge }
}

export async function assignMedia(
  req: Request,
  env: MediaEnv,
  h: JsonH,
  articleId: string,
  mediaId: string,
  actor: AdminUser,
  options: { publish?: boolean } = {},
): Promise<Response> {
  const idemKey = req.headers.get('Idempotency-Key')
  if (!idemKey) return err(h, 400, 'bad_request', 'Idempotency-Key header required')
  const replay = await findIdempotentReplay(env, idemKey)
  if (replay !== null) return json(replay, 200, { ...h, 'Idempotent-Replay': 'true' })

  const expected = req.headers.get('X-Expected-Updated-At')
  const article = await fetchMatrixRow(env, articleId)
  if (article === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (article === null) return err(h, 404, 'not_found', 'Article not found')

  const mediaRes = await sbRest(
    env,
    `article_media?id=eq.${encodeURIComponent(mediaId)}&article_id=eq.${encodeURIComponent(articleId)}&select=*`,
  )
  if (!mediaRes || !mediaRes.ok) return err(h, 502, 'upstream_error', 'Failed to load media')
  const mediaRows = await mediaRes.json().catch(() => []) as Array<Record<string, unknown>>
  const media = mediaRows[0]
  if (!media) return err(h, 404, 'not_found', 'Media not found for this article')
  if (!['candidate', 'archived', 'live'].includes(String(media.status))) {
    return err(h, 409, 'conflict', `Cannot assign media in status '${String(media.status)}'`)
  }

  const assigned = await setLiveMedia(env, article, media, actor, expected)
  if (!assigned.ok) return err(h, assigned.status, assigned.error, assigned.message)

  let publishResult: Record<string, unknown> | undefined
  if (options.publish && assigned.article.text_status !== 'published') {
    // Minimal publish path (mirror index publishArticle core).
    const now = new Date().toISOString()
    const isRepublish = typeof assigned.article.published_at === 'string' && !!assigned.article.published_at
    const publishedAt = isRepublish ? assigned.article.published_at : now
    const curFm = assigned.article.frontmatter && typeof assigned.article.frontmatter === 'object' && !Array.isArray(assigned.article.frontmatter)
      ? assigned.article.frontmatter as Record<string, unknown>
      : {}
    const fm = { ...curFm, published_via: 'dynamic', ...(isRepublish ? {} : { date: now.slice(0, 10) }) }
    const headers = serviceHeaders(env, { Prefer: 'return=representation' })
    if (!headers) return err(h, 503, 'not_configured', 'Database not configured')
    const pubRes = await fetch(
      `${sbBase(env)}/rest/v1/content_matrix?id=eq.${encodeURIComponent(articleId)}&text_status=in.(approved,draft,unpublished)`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ text_status: 'published', published_at: publishedAt, frontmatter: fm }),
      },
    )
    if (!pubRes.ok) return err(h, 502, 'upstream_error', 'Media assigned but publish failed')
    const published = (await pubRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
    if (!published) return err(h, 409, 'conflict', 'Cannot publish from current status')
    const purge = await purgeRenderer(env, published.category, published.slug)
    publishResult = { item: published, purge_ok: purge.ok, purge_detail: purge.detail }
    assigned.article = published
    assigned.purge = purge
  } else if (options.publish && assigned.article.text_status === 'published') {
    // Already published: re-purge to surface new image.
    const purge = await purgeRenderer(env, assigned.article.category, assigned.article.slug)
    assigned.purge = purge
  }

  const result = {
    item: assigned.article,
    media: assigned.media,
    purge_ok: assigned.purge ? assigned.purge.ok : null,
    purge_detail: assigned.purge?.detail,
    published: !!options.publish,
    publish: publishResult,
  }

  await insertAuditEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: options.publish ? 'media.apply_and_publish' : 'media.assign',
    target_type: 'media',
    target_id: mediaId,
    before: { image_filename: article.image_filename, active_media_id: article.active_media_id },
    after: { image_filename: assigned.article.image_filename, active_media_id: mediaId },
    idempotency_key: idemKey,
    request_id: req.headers.get('cf-ray'),
    result,
  })
  await insertMediaEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: options.publish ? 'media.apply_and_publish' : 'media.assign',
    article_id: articleId,
    media_id: mediaId,
    before: { image_filename: article.image_filename },
    after: { image_filename: assigned.article.image_filename },
    idempotency_key: idemKey,
  })

  return json(result, 200, h)
}

export async function archiveMedia(
  req: Request,
  env: MediaEnv,
  h: JsonH,
  articleId: string,
  mediaId: string,
  actor: AdminUser,
): Promise<Response> {
  const idemKey = req.headers.get('Idempotency-Key')
  if (!idemKey) return err(h, 400, 'bad_request', 'Idempotency-Key header required')
  const replay = await findIdempotentReplay(env, idemKey)
  if (replay !== null) return json(replay, 200, { ...h, 'Idempotent-Replay': 'true' })

  const article = await fetchMatrixRow(env, articleId)
  if (article === undefined) return err(h, 502, 'upstream_error', 'Failed to load article')
  if (article === null) return err(h, 404, 'not_found', 'Article not found')

  const mediaRes = await sbRest(
    env,
    `article_media?id=eq.${encodeURIComponent(mediaId)}&article_id=eq.${encodeURIComponent(articleId)}&select=*`,
  )
  if (!mediaRes || !mediaRes.ok) return err(h, 502, 'upstream_error', 'Failed to load media')
  const media = (await mediaRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
  if (!media) return err(h, 404, 'not_found', 'Media not found')

  const headers = serviceHeaders(env, { Prefer: 'return=representation' })
  if (!headers) return err(h, 503, 'not_configured', 'Database not configured')

  const wasLive = media.status === 'live' || article.active_media_id === mediaId || article.image_filename === media.storage_key
  const archRes = await fetch(
    `${sbBase(env)}/rest/v1/article_media?id=eq.${encodeURIComponent(mediaId)}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'archived', retired_at: new Date().toISOString() }),
    },
  )
  if (!archRes.ok) return err(h, 502, 'upstream_error', 'Failed to archive media')
  const archived = (await archRes.json().catch(() => []) as Array<Record<string, unknown>>)[0] || media

  let updatedArticle = article
  let purge: { ok: boolean; detail?: string } | null = null
  if (wasLive) {
    // Find previous archived version for soft rollback pointer, else clear.
    const prevRes = await sbRest(
      env,
      `article_media?article_id=eq.${encodeURIComponent(articleId)}&status=eq.archived&id=neq.${encodeURIComponent(mediaId)}&select=*&order=version.desc&limit=1`,
    )
    const prev = prevRes && prevRes.ok
      ? (await prevRes.json().catch(() => []) as Array<Record<string, unknown>>)[0]
      : null
    const revision = (typeof article.revision_count === 'number' ? article.revision_count : 0) + 1
    const patch: Record<string, unknown> = {
      revision_count: revision,
      active_media_id: prev?.id || null,
      image_filename: prev?.storage_key || null,
      image_url: prev?.storage_key
        ? publicImageUrl(env.SITE_URL || 'https://1001sovet.ru', String(prev.storage_key))
        : null,
    }
    const patchRes = await fetch(
      `${sbBase(env)}/rest/v1/content_matrix?id=eq.${encodeURIComponent(articleId)}`,
      { method: 'PATCH', headers, body: JSON.stringify(patch) },
    )
    if (patchRes.ok) {
      updatedArticle = (await patchRes.json().catch(() => []) as Array<Record<string, unknown>>)[0] || article
      await insertRevision(env, { matrix_id: articleId, revision, snapshot: article, actor_id: actor.id })
    }
    if (article.text_status === 'published') {
      purge = await purgeRenderer(env, article.category, article.slug)
    }
  }

  const result = {
    media: mediaPublic(env, archived),
    item: updatedArticle,
    purge_ok: purge ? purge.ok : null,
    detached: wasLive,
  }
  await insertAuditEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'media.archive',
    target_type: 'media',
    target_id: mediaId,
    before: { status: media.status, image_filename: article.image_filename },
    after: { status: 'archived', image_filename: updatedArticle.image_filename },
    idempotency_key: idemKey,
    request_id: req.headers.get('cf-ray'),
    result,
  })
  await insertMediaEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'media.archive',
    article_id: articleId,
    media_id: mediaId,
    before: { status: media.status },
    after: { status: 'archived' },
    idempotency_key: idemKey,
  })
  return json(result, 200, h)
}

export async function rollbackMedia(
  req: Request,
  env: MediaEnv,
  h: JsonH,
  articleId: string,
  mediaId: string,
  actor: AdminUser,
): Promise<Response> {
  // Rollback = re-assign a previously archived (or any non-failed) version.
  return assignMedia(req, env, h, articleId, mediaId, actor, { publish: false })
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function getJob(env: MediaEnv, h: JsonH, jobId: string): Promise<Response> {
  const res = await sbRest(env, `media_generation_jobs?id=eq.${encodeURIComponent(jobId)}&select=*`)
  if (!res || !res.ok) return err(h, 502, 'upstream_error', 'Failed to load job')
  const rows = await res.json().catch(() => []) as Array<Record<string, unknown>>
  if (!rows[0]) return err(h, 404, 'not_found', 'Job not found')
  let media: Record<string, unknown>[] = []
  const ids = Array.isArray(rows[0].media_ids) ? rows[0].media_ids as string[] : []
  if (ids.length) {
    const mRes = await sbRest(env, `article_media?id=in.(${ids.join(',')})&select=*`)
    if (mRes && mRes.ok) {
      media = (await mRes.json().catch(() => []) as Array<Record<string, unknown>>).map((m) => mediaPublic(env, m))
    }
  }
  return json({ job: rows[0], media }, 200, h)
}

export async function retryJob(
  req: Request,
  env: MediaEnv,
  h: JsonH,
  jobId: string,
  actor: AdminUser,
  ctx?: ExecutionContext,
): Promise<Response> {
  const idemKey = req.headers.get('Idempotency-Key')
  if (!idemKey) return err(h, 400, 'bad_request', 'Idempotency-Key header required')
  const replay = await findIdempotentReplay(env, idemKey)
  if (replay !== null) return json(replay, 200, { ...h, 'Idempotent-Replay': 'true' })

  const res = await sbRest(env, `media_generation_jobs?id=eq.${encodeURIComponent(jobId)}&select=*`)
  if (!res || !res.ok) return err(h, 502, 'upstream_error', 'Failed to load job')
  const job = (await res.json().catch(() => []) as Array<Record<string, unknown>>)[0]
  if (!job) return err(h, 404, 'not_found', 'Job not found')
  if (job.status !== 'failed' && job.status !== 'cancelled') {
    return err(h, 409, 'conflict', `Job is '${String(job.status)}', only failed/cancelled can retry`)
  }
  if (job.retryable === false) {
    return err(h, 409, 'not_retryable', 'Job is marked non-retryable')
  }
  const attempt = typeof job.attempt === 'number' ? job.attempt : 0
  const max = typeof job.max_attempts === 'number' ? job.max_attempts : 3
  if (attempt >= max) {
    return err(h, 409, 'max_attempts', `Max attempts (${max}) reached`)
  }

  await patchJob(env, jobId, {
    status: 'queued',
    progress: 0,
    error_code: null,
    error_message: null,
    finished_at: null,
  })

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(runGenerationJob(env, jobId))
  }

  const result = { job_id: jobId, status: 'queued' }
  await insertAuditEvent(env, {
    actor_id: actor.id,
    actor_email: actor.email,
    action: 'media.job.retry',
    target_type: 'media',
    target_id: jobId,
    before: { status: job.status, attempt },
    after: { status: 'queued' },
    idempotency_key: idemKey,
    request_id: req.headers.get('cf-ray'),
    result,
  })
  return json(result, 202, h)
}
