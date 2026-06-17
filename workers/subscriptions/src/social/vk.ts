import type { Env } from '../types'
import { selectRows } from '../supabase'
import vkPublicationIndex from '../generated/vk-publication-index.json'

export type VkArticleRecord = {
  article_slug: string
  category_slug: string
  title: string
  description: string
  canonical_path: string
  image_path: string
  plain_text: string
  published_at: string | null
}

const index: VkArticleRecord[] = vkPublicationIndex as VkArticleRecord[]

export const MAX_VK_MESSAGE_CHARS = 60000
const DEFAULT_VK_API_BASE = 'https://api.vk.com/method'

export type VkConfig = {
  accessToken: string
  photoAccessToken?: string
  groupId: string
  apiVersion: string
  apiBaseUrl: string
}

export type VkPostInput = {
  record: VkArticleRecord
  siteUrl: string
}

export type VkPostResult = {
  message: string
  canonicalUrl: string
  imageUrl: string
  messageLength: number
  bodyHash: string
}

export type VkPublishOptions = {
  dryRun?: boolean
  requirePhoto?: boolean
  allowLinkFallback?: boolean
  groupOverride?: VkGroupOverride
}

export type VkPublishResult = {
  ok: boolean
  dryRun?: boolean
  articleSlug: string
  providerPostId?: string
  postUrl?: string
  messageLength: number
  bodyHash: string
  error?: string
  errorCode?: string
  publishMode?: 'photo_upload' | 'link_preview' | 'text_with_links'
}

// Resolve which VK community group a category posts to. VK_GROUPS_BY_CATEGORY
// is a JSON map:  { "<category_slug>": { "groupId": "123" }, ... }
// Only groupId is per-group — the owner token (VK_ACCESS_TOKEN /
// VK_PHOTO_ACCESS_TOKEN) works for all groups the user admins, so no per-group
// token is needed. Returns undefined → caller uses default VK_GROUP_ID.
export type VkGroupOverride = { groupId: string }

export function resolveVkGroupForCategory(env: Env, categorySlug: string): VkGroupOverride | undefined {
  const raw = String(env.VK_GROUPS_BY_CATEGORY || '').trim()
  if (!raw) return undefined
  try {
    const map = JSON.parse(raw) as Record<string, { groupId?: string }>
    const entry = map[categorySlug]
    if (entry?.groupId) return { groupId: entry.groupId }
  } catch {
    // malformed JSON — log and fall back to default group
    console.warn('[vk] VK_GROUPS_BY_CATEGORY is not valid JSON — falling back to default group')
  }
  return undefined
}

export function validateVkConfig(env: Env): VkConfig {
  const accessToken = String(env.VK_ACCESS_TOKEN || '').trim()
  const photoAccessToken = String(env.VK_PHOTO_ACCESS_TOKEN || '').trim() || undefined
  const groupId = String(env.VK_GROUP_ID || '').trim()
  const apiVersion = String(env.VK_API_VERSION || '5.199').trim()
  const apiBaseUrl = String(env.VK_API_BASE_URL || DEFAULT_VK_API_BASE).trim()

  if (!accessToken) throw new Error('vk_access_token_not_configured')
  if (!groupId) throw new Error('vk_group_id_not_configured')

  return { accessToken, photoAccessToken, groupId, apiVersion, apiBaseUrl }
}

export function findArticleRecord(articleSlug: string): VkArticleRecord | undefined {
  return index.find((r) => r.article_slug === articleSlug)
}

type ContentMatrixRow = {
  slug: string
  category: string
  title: string
  description: string | null
  image_filename: string | null
  published_at: string | null
}

/**
 * Resolve an article for social posting from either source, in priority order:
 *   1. the static vk-publication-index.json (existing MDX articles — baked at
 *      deploy; no DB call, behaviour byte-identical to before);
 *   2. content_matrix (articles published by the no-redeploy factory, which
 *      never produce MDX and so are absent from the static index).
 * Returns undefined ONLY when neither source has the slug (genuine
 * not-found). A content_matrix query/Supabase failure is NOT swallowed — it
 * throws Error('article_lookup_failed') so callers can distinguish a transient
 * lookup error from missing data (otherwise a flaky DB would look like
 * "article_not_found" and corrupt autopost diagnostics).
 *
 * The content_matrix fallback builds a short-announcement record (variant б):
 * title + description + canonical link + photo. The article body stays behind
 * the link — no Markdown strip in the worker yet (possible follow-up).
 */
export async function resolveArticleRecord(env: Env, articleSlug: string): Promise<VkArticleRecord | undefined> {
  const fromIndex = findArticleRecord(articleSlug)
  if (fromIndex) return fromIndex

  let rows: ContentMatrixRow[]
  try {
    rows = await selectRows<ContentMatrixRow>(
      env,
      'content_matrix',
      [
        `slug=eq.${encodeURIComponent(articleSlug)}`,
        'domain=eq.1001sovet.ru',
        'text_status=eq.published',
        'select=slug,category,title,description,image_filename,published_at',
        'limit=1',
      ].join('&'),
    )
  } catch (err) {
    // Surface as a distinct, diagnosable error — do NOT collapse to not-found.
    const e = new Error('article_lookup_failed')
    ;(e as Error & { cause?: unknown }).cause = err
    throw e
  }

  const row = rows[0]
  if (!row || !row.category || !row.title) return undefined

  return {
    article_slug: row.slug,
    category_slug: row.category,
    title: row.title,
    description: row.description || '',
    canonical_path: `/${row.category}/${row.slug}/`,
    image_path: row.image_filename ? `/images/${row.image_filename}` : `/images/${row.slug}.jpg`,
    plain_text: '',
    published_at: row.published_at,
  }
}

export function buildVkArticlePost(input: VkPostInput): VkPostResult {
  const { record, siteUrl } = input
  const canonicalUrl = `${siteUrl.replace(/\/+$/, '')}${record.canonical_path}`
  const imageUrl = `${siteUrl.replace(/\/+$/, '')}${record.image_path}`

  const parts: string[] = []
  if (record.title) parts.push(record.title)
  if (record.description && record.description !== record.title) parts.push(record.description)
  if (record.plain_text) parts.push(record.plain_text)

  parts.push(`Источник: ${canonicalUrl}`)
  parts.push(`СоветыДома ${record.category_slug}`)

  const message = parts.join('\n\n')
  const messageLength = [...message].length // Unicode code points

  if (messageLength > MAX_VK_MESSAGE_CHARS) {
    const err = new Error('message_too_long')
    ;(err as Error & { code?: string }).code = 'message_too_long'
    throw err
  }

  const bodyHashInput = `${message}\n${imageUrl}`
  const bodyHash = bodyHashInput // placeholder; caller must compute sha256 for DB

  return { message, canonicalUrl, imageUrl, messageLength, bodyHash }
}

export async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// SSRF guard: true only if `url` is on the same origin as `siteUrl`. Used before
// fetching article images so a malicious absolute image_path can't redirect the
// worker to an arbitrary host.
export function isSameOrigin(url: string, siteUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(siteUrl).origin
  } catch {
    return false
  }
}

export async function getWallUploadServer(env: Env, config: VkConfig): Promise<string> {
  const url = new URL(`${config.apiBaseUrl}/photos.getWallUploadServer`)
  url.searchParams.set('access_token', config.photoAccessToken || config.accessToken)
  url.searchParams.set('v', config.apiVersion)
  url.searchParams.set('group_id', config.groupId)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`vk_upload_server_http_${res.status}`)
  }
  const data = await res.json() as { response?: { upload_url?: string }; error?: { error_code?: number; error_msg?: string } }
  if (data.error) {
    throw new Error(`vk_${data.error.error_code || 'unknown'}: ${data.error.error_msg || 'unknown'}`)
  }
  const uploadUrl = data.response?.upload_url
  if (!uploadUrl) throw new Error('vk_upload_url_missing')
  return uploadUrl
}

export async function uploadWallPhoto(uploadUrl: string, imageBytes: ArrayBuffer, filename: string): Promise<unknown> {
  const form = new FormData()
  form.append('photo', new Blob([imageBytes]), filename)

  const res = await fetch(uploadUrl, { method: 'POST', body: form })
  if (!res.ok) {
    throw new Error(`vk_upload_http_${res.status}`)
  }
  return res.json()
}

export async function saveWallPhoto(env: Env, config: VkConfig, uploadResult: { server?: string; photo?: string; hash?: string }): Promise<string> {
  const url = new URL(`${config.apiBaseUrl}/photos.saveWallPhoto`)
  url.searchParams.set('access_token', config.photoAccessToken || config.accessToken)
  url.searchParams.set('v', config.apiVersion)
  url.searchParams.set('group_id', config.groupId)
  if (uploadResult.server) url.searchParams.set('server', uploadResult.server)
  if (uploadResult.photo) url.searchParams.set('photo', uploadResult.photo)
  if (uploadResult.hash) url.searchParams.set('hash', uploadResult.hash)

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`vk_save_photo_http_${res.status}`)
  }
  const data = await res.json() as { response?: Array<{ id?: number; owner_id?: number }>; error?: { error_code?: number; error_msg?: string } }
  if (data.error) {
    throw new Error(`vk_${data.error.error_code || 'unknown'}: ${data.error.error_msg || 'unknown'}`)
  }
  const photo = data.response?.[0]
  if (!photo?.id || !photo?.owner_id) throw new Error('vk_saved_photo_missing')
  return `photo${photo.owner_id}_${photo.id}`
}

export async function postToWall(env: Env, config: VkConfig, message: string, attachment?: string): Promise<number> {
  // POST with a form body — a full article message (4000+ Cyrillic chars) in a
  // GET query string blows the URL past length limits and the request fails.
  const body = new URLSearchParams()
  body.set('access_token', config.accessToken)
  body.set('v', config.apiVersion)
  body.set('owner_id', `-${config.groupId}`)
  body.set('from_group', '1')
  body.set('message', message)
  if (attachment) body.set('attachments', attachment)

  const res = await fetch(`${config.apiBaseUrl}/wall.post`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    throw new Error(`vk_wall_post_http_${res.status}`)
  }
  const data = await res.json() as { response?: { post_id?: number }; error?: { error_code?: number; error_msg?: string } }
  if (data.error) {
    throw new Error(`vk_${data.error.error_code || 'unknown'}: ${data.error.error_msg || 'unknown'}`)
  }
  const postId = data.response?.post_id
  if (!postId) throw new Error('vk_post_id_missing')
  return postId
}

function isVkLinkPreviewError(error: Error): boolean {
  return /vk_100|link_photo_sizing_rule|No photo given|attachments support/i.test(error.message)
}

export async function publishArticleToVk(
  env: Env,
  articleSlug: string,
  options: VkPublishOptions = {},
): Promise<VkPublishResult> {
  const { dryRun = false, requirePhoto = true } = options
  const allowLinkFallback = options.allowLinkFallback ?? !requirePhoto

  let config: VkConfig
  try {
    config = validateVkConfig(env)
  } catch (err) {
    return { ok: false, articleSlug, messageLength: 0, bodyHash: '', error: (err as Error).message, errorCode: 'provider_unconfigured' }
  }

  // Apply per-category group override (tokens stay the same — one user token
  // works for all groups the owner admins).
  if (options.groupOverride?.groupId) {
    config = { ...config, groupId: options.groupOverride.groupId }
  }

  const siteUrl = String(env.PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')
  let record: VkArticleRecord | undefined
  try {
    record = await resolveArticleRecord(env, articleSlug)
  } catch (err) {
    // Transient lookup/DB error — distinct from "not found" so autopost logs are honest.
    return { ok: false, articleSlug, messageLength: 0, bodyHash: '', error: (err as Error).message, errorCode: 'article_lookup_failed' }
  }

  if (!record) {
    return { ok: false, articleSlug, messageLength: 0, bodyHash: '', error: 'article_not_found', errorCode: 'article_not_found' }
  }

  let post: VkPostResult
  try {
    post = buildVkArticlePost({ record, siteUrl })
  } catch (err) {
    const code = (err && typeof err === 'object' && 'code' in err) ? String((err as { code?: string }).code) : 'build_failed'
    return { ok: false, articleSlug, messageLength: 0, bodyHash: '', error: (err as Error).message, errorCode: code }
  }

  // Compute real body hash for DB
  const bodyHash = await sha256Text(`${post.message}\n${post.imageUrl}`)
  post.bodyHash = bodyHash

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      articleSlug,
      messageLength: post.messageLength,
      bodyHash,
    }
  }

  // Fetch image — SSRF guard: only from our own site origin.
  let imageBytes: ArrayBuffer | null = null
  if (isSameOrigin(post.imageUrl, siteUrl)) {
    try {
      const imageRes = await fetch(post.imageUrl)
      if (imageRes.ok) {
        imageBytes = await imageRes.arrayBuffer()
      }
    } catch {
      imageBytes = null
    }
  }

  if (!imageBytes && requirePhoto && !allowLinkFallback) {
    return { ok: false, articleSlug, messageLength: post.messageLength, bodyHash, error: 'image_fetch_failed', errorCode: 'image_required' }
  }

  let attachment = ''
  if (imageBytes && config.photoAccessToken) {
    try {
      const uploadUrl = await getWallUploadServer(env, config)
      const uploadResult = await uploadWallPhoto(uploadUrl, imageBytes, `${articleSlug}.jpg`) as { server?: string; photo?: string; hash?: string }
      const photoAttachment = await saveWallPhoto(env, config, uploadResult)
      attachment = photoAttachment
    } catch (err) {
      if (requirePhoto && !allowLinkFallback) {
        return { ok: false, articleSlug, messageLength: post.messageLength, bodyHash, error: (err as Error).message, errorCode: 'photo_upload_failed' }
      }
      // If photo not required, continue without attachment
    }
  }

  const linkAttachment = `link=${post.canonicalUrl}`
  let publishMode: NonNullable<VkPublishResult['publishMode']> = attachment ? 'photo_upload' : 'link_preview'
  const message = post.message
  const messageLength = [...message].length
  if (messageLength > MAX_VK_MESSAGE_CHARS) {
    return { ok: false, articleSlug, messageLength, bodyHash, error: 'message_too_long', errorCode: 'message_too_long' }
  }

  try {
    let postId: number
    try {
      postId = await postToWall(env, config, message, attachment || linkAttachment)
    } catch (err) {
      if (attachment || !allowLinkFallback || !isVkLinkPreviewError(err as Error)) throw err
      publishMode = 'text_with_links'
      postId = await postToWall(env, config, message)
    }
    const postUrl = `https://vk.com/wall-${config.groupId}_${postId}`
    return {
      ok: true,
      articleSlug,
      providerPostId: String(postId),
      postUrl,
      messageLength,
      bodyHash,
      publishMode,
    }
  } catch (err) {
    return { ok: false, articleSlug, messageLength, bodyHash, error: (err as Error).message, errorCode: 'wall_post_failed' }
  }
}

// ── Responder reply primitives ───────────────────────────────────────────────
async function vkApiCall(config: VkConfig, method: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...params, access_token: config.accessToken, v: config.apiVersion })
  const res = await fetch(`${config.apiBaseUrl}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString(),
  })
  const data = await res.json() as { response?: Record<string, unknown> | number; error?: { error_code?: number; error_msg?: string } }
  if (data.error) throw new Error(`vk_${data.error.error_code || 'unknown'}: ${data.error.error_msg || 'unknown'}`)
  return typeof data.response === 'object' && data.response ? data.response : { value: data.response }
}

export async function vkReplyToComment(config: VkConfig, postId: string, message: string, replyToComment?: string): Promise<string> {
  const params: Record<string, string> = { owner_id: `-${config.groupId}`, post_id: String(postId), from_group: '1', message }
  if (replyToComment) params.reply_to_comment = String(replyToComment)
  const r = await vkApiCall(config, 'wall.createComment', params)
  return String(r.comment_id ?? '')
}

export async function vkSendMessage(config: VkConfig, peerId: string, message: string): Promise<string> {
  const r = await vkApiCall(config, 'messages.send', {
    peer_id: String(peerId), message, group_id: String(config.groupId),
    random_id: String(Math.floor(Math.random() * 1e9)),
  })
  return String(r.value ?? '')
}
