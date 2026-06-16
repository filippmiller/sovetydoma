import type { Env } from '../types'
import { findArticleRecord, isSameOrigin, sha256Text, type VkArticleRecord } from './vk'

// Facebook page feed/photo caption hard limit.
export const MAX_FB_MESSAGE_CHARS = 63206
const DEFAULT_FB_API_BASE = 'https://graph.facebook.com'
const DEFAULT_FB_API_VERSION = 'v23.0'

export type FbConfig = {
  pageId: string
  pageAccessToken: string
  apiVersion: string
  apiBaseUrl: string
}

export type FbPostResult = {
  message: string
  canonicalUrl: string
  imageUrl: string
  messageLength: number
  bodyHash: string
}

export type FbPublishOptions = {
  dryRun?: boolean
  requirePhoto?: boolean
  allowLinkFallback?: boolean
  pageOverride?: FbPageOverride
}

export type FbPublishResult = {
  ok: boolean
  dryRun?: boolean
  articleSlug: string
  providerPostId?: string
  postUrl?: string
  messageLength: number
  bodyHash: string
  error?: string
  errorCode?: string
  publishMode?: 'photo_url' | 'link_post'
}

export type FbPageOverride = { id: string; token: string }

export function validateFbConfig(env: Env, override?: FbPageOverride): FbConfig {
  const pageId = String(override?.id || env.FB_PAGE_ID || '').trim()
  const pageAccessToken = String(override?.token || env.FB_PAGE_ACCESS_TOKEN || '').trim()
  const apiVersion = String(env.FB_API_VERSION || DEFAULT_FB_API_VERSION).trim()
  const apiBaseUrl = String(env.FB_API_BASE_URL || DEFAULT_FB_API_BASE).trim().replace(/\/+$/, '')

  if (!pageId) throw new Error('fb_page_id_not_configured')
  if (!pageAccessToken) throw new Error('fb_page_access_token_not_configured')

  return { pageId, pageAccessToken, apiVersion, apiBaseUrl }
}

// Resolve which Page a category posts to. FB_PAGES_BY_CATEGORY is JSON:
//   {"dacha-i-ogorod":{"id":"...","token":"..."}, "kulinaria":{...}}
// Returns undefined → caller falls back to the default FB_PAGE_ID/TOKEN.
export function resolveFbPageForCategory(env: Env, categorySlug: string): FbPageOverride | undefined {
  const raw = String(env.FB_PAGES_BY_CATEGORY || '').trim()
  if (!raw) return undefined
  try {
    const map = JSON.parse(raw) as Record<string, { id?: string; token?: string }>
    const entry = map[categorySlug]
    if (entry?.id && entry?.token) return { id: entry.id, token: entry.token }
  } catch {
    // malformed config — fall back to default page
  }
  return undefined
}

export function buildFbArticlePost(record: VkArticleRecord, siteUrl: string): FbPostResult {
  const base = siteUrl.replace(/\/+$/, '')
  const canonicalUrl = `${base}${record.canonical_path}`
  const imageUrl = `${base}${record.image_path}`

  const parts: string[] = []
  if (record.title) parts.push(record.title)
  if (record.description && record.description !== record.title) parts.push(record.description)
  if (record.plain_text) parts.push(record.plain_text)
  parts.push(`Источник: ${canonicalUrl}`)

  const message = parts.join('\n\n')
  const messageLength = [...message].length

  if (messageLength > MAX_FB_MESSAGE_CHARS) {
    const err = new Error('message_too_long')
    ;(err as Error & { code?: string }).code = 'message_too_long'
    throw err
  }

  return { message, canonicalUrl, imageUrl, messageLength, bodyHash: '' }
}

type FbApiError = { error?: { message?: string; code?: number; type?: string } }

async function fbApiPost(config: FbConfig, edge: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${config.apiBaseUrl}/${config.apiVersion}/${config.pageId}/${edge}`
  const body = new URLSearchParams({ ...params, access_token: config.pageAccessToken })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const data = await res.json().catch(() => ({})) as Record<string, unknown> & FbApiError
  if (!res.ok || data.error) {
    const code = data.error?.code ?? res.status
    const msg = data.error?.message || `http_${res.status}`
    throw new Error(`fb_${code}: ${msg}`)
  }
  return data
}

// Posts the photo by public URL — Facebook fetches the image itself.
// Kept as a fallback; the byte-upload path below is more reliable.
export async function postPhotoByUrl(config: FbConfig, imageUrl: string, caption: string): Promise<string> {
  const data = await fbApiPost(config, 'photos', { url: imageUrl, caption })
  const postId = String(data.post_id || data.id || '')
  if (!postId) throw new Error('fb_post_id_missing')
  return postId
}

// Uploads the image bytes directly as multipart `source`. More reliable than
// the url method (which fails with error 324 on some Pages even when the image
// is publicly reachable).
export async function postPhotoBytes(config: FbConfig, imageBytes: ArrayBuffer, filename: string, caption: string): Promise<string> {
  const form = new FormData()
  form.append('access_token', config.pageAccessToken)
  form.append('caption', caption)
  form.append('source', new Blob([imageBytes], { type: 'image/jpeg' }), filename)

  const url = `${config.apiBaseUrl}/${config.apiVersion}/${config.pageId}/photos`
  const res = await fetch(url, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({})) as Record<string, unknown> & { error?: { message?: string; code?: number } }
  if (!res.ok || data.error) {
    const code = data.error?.code ?? res.status
    const msg = data.error?.message || `http_${res.status}`
    throw new Error(`fb_${code}: ${msg}`)
  }
  const postId = String(data.post_id || data.id || '')
  if (!postId) throw new Error('fb_post_id_missing')
  return postId
}

export async function postFeedLink(config: FbConfig, message: string, link: string): Promise<string> {
  const data = await fbApiPost(config, 'feed', { message, link })
  const postId = String(data.id || '')
  if (!postId) throw new Error('fb_post_id_missing')
  return postId
}

export async function publishArticleToFacebook(
  env: Env,
  articleSlug: string,
  options: FbPublishOptions = {},
): Promise<FbPublishResult> {
  const { dryRun = false, requirePhoto = true } = options
  const allowLinkFallback = options.allowLinkFallback ?? !requirePhoto

  let config: FbConfig
  try {
    config = validateFbConfig(env, options.pageOverride)
  } catch (err) {
    return { ok: false, articleSlug, messageLength: 0, bodyHash: '', error: (err as Error).message, errorCode: 'provider_unconfigured' }
  }

  const siteUrl = String(env.PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')
  const record = findArticleRecord(articleSlug)
  if (!record) {
    return { ok: false, articleSlug, messageLength: 0, bodyHash: '', error: 'article_not_found', errorCode: 'article_not_found' }
  }

  let post: FbPostResult
  try {
    post = buildFbArticlePost(record, siteUrl)
  } catch (err) {
    const code = (err && typeof err === 'object' && 'code' in err) ? String((err as { code?: string }).code) : 'build_failed'
    return { ok: false, articleSlug, messageLength: 0, bodyHash: '', error: (err as Error).message, errorCode: code }
  }

  const bodyHash = await sha256Text(`fb\n${post.message}\n${post.imageUrl}`)
  post.bodyHash = bodyHash

  if (dryRun) {
    return { ok: true, dryRun: true, articleSlug, messageLength: post.messageLength, bodyHash }
  }

  // Fetch the image bytes up front so we can upload them directly (most reliable).
  // SSRF guard: only fetch images from our own site origin — a malicious absolute
  // image_path in frontmatter must not make the worker fetch an arbitrary URL.
  let imageBytes: ArrayBuffer | null = null
  if (isSameOrigin(post.imageUrl, siteUrl)) {
    try {
      const imageRes = await fetch(post.imageUrl)
      if (imageRes.ok) imageBytes = await imageRes.arrayBuffer()
    } catch {
      imageBytes = null
    }
  }

  try {
    let providerPostId: string
    let publishMode: NonNullable<FbPublishResult['publishMode']> = 'photo_url'
    try {
      if (imageBytes) {
        providerPostId = await postPhotoBytes(config, imageBytes, `${articleSlug}.jpg`, post.message)
      } else {
        // No bytes (fetch failed) — let Facebook try to pull the URL itself.
        providerPostId = await postPhotoByUrl(config, post.imageUrl, post.message)
      }
    } catch (err) {
      if (requirePhoto && !allowLinkFallback) {
        return { ok: false, articleSlug, messageLength: post.messageLength, bodyHash, error: (err as Error).message, errorCode: 'photo_post_failed' }
      }
      publishMode = 'link_post'
      providerPostId = await postFeedLink(config, post.message, post.canonicalUrl)
    }
    const postUrl = `https://www.facebook.com/${providerPostId}`
    return {
      ok: true,
      articleSlug,
      providerPostId,
      postUrl,
      messageLength: post.messageLength,
      bodyHash,
      publishMode,
    }
  } catch (err) {
    return { ok: false, articleSlug, messageLength: post.messageLength, bodyHash, error: (err as Error).message, errorCode: 'feed_post_failed' }
  }
}

// ── Responder reply primitives ───────────────────────────────────────────────
export async function fbReplyToComment(config: FbConfig, commentId: string, message: string): Promise<string> {
  const url = `${config.apiBaseUrl}/${config.apiVersion}/${commentId}/comments`
  const body = new URLSearchParams({ message, access_token: config.pageAccessToken })
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() })
  const data = await res.json().catch(() => ({})) as Record<string, unknown> & FbApiError
  if (!res.ok || data.error) throw new Error(`fb_${data.error?.code ?? res.status}: ${data.error?.message || 'http_' + res.status}`)
  return String(data.id ?? '')
}

export async function fbSendMessage(config: FbConfig, recipientId: string, text: string): Promise<string> {
  const url = `${config.apiBaseUrl}/${config.apiVersion}/${config.pageId}/messages?access_token=${encodeURIComponent(config.pageAccessToken)}`
  const res = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text }, messaging_type: 'RESPONSE' }),
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown> & FbApiError
  if (!res.ok || data.error) throw new Error(`fb_${data.error?.code ?? res.status}: ${data.error?.message || 'http_' + res.status}`)
  return String(data.message_id ?? '')
}
