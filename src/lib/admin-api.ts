/**
 * Typed client for the `sovetydoma-admin-api` worker — the runtime admin
 * article manager (replaces the build-time MDX-only admin flow).
 *
 * Auth: every request carries `Authorization: Bearer <supabase access_token>`
 * taken from the current Supabase session. Static-export safe: browser-only
 * fetch, no server actions / route handlers / next/headers.
 *
 * Error policy: NEVER swallow. Every failure is thrown as AdminApiError
 * (HTTP error, network failure, missing config, missing session) so callers
 * can surface a visible error state.
 */

export class AdminApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
  }
}

export type AdminTextStatus =
  | 'idea'
  | 'draft'
  | 'reviewed'
  | 'approved'
  | 'published'
  | 'unpublished'
  | 'scheduled'

export interface AdminArticleListItem {
  id: string
  slug: string
  category: string
  title: string
  text_status: string
  disposition: string | null
  updated_at: string
  created_at: string
  published_at: string | null
  image_filename: string | null
  revision_count: number
  quality_score?: number | null
  published_via?: string | null
}

export interface AdminArticleListResponse {
  items: AdminArticleListItem[]
  page: number
  per_page: number
  total: number
}

/** Full row. Known columns are typed; extra DB columns are tolerated. */
export interface AdminArticle extends AdminArticleListItem {
  description?: string | null
  body_md: string
  frontmatter: Record<string, unknown>
  [key: string]: unknown
}

export interface ListArticlesParams {
  page?: number
  per_page?: number
  status?: string
  category?: string
  q?: string
  sort?: string
}

/** PATCH body allow-list (enforced server-side too). */
export interface UpdateArticlePatch {
  title?: string
  description?: string
  body_md?: string
  frontmatter?: Record<string, unknown>
}

export interface PublishArticleResult {
  item: AdminArticle
  purge_ok: boolean
  index_ok?: boolean
  already_published?: boolean
  already_unpublished?: boolean
  purge_detail?: string | null
  purge_status?: number | null
}

export type MediaVersionStatus =
  | 'live'
  | 'candidate'
  | 'generating'
  | 'failed'
  | 'rejected'
  | 'archived'

export interface ArticleMediaVersion {
  id: string | null
  article_id?: string
  version: number
  storage_key: string
  preview_key?: string | null
  mime?: string
  width?: number | null
  height?: number | null
  sha256?: string | null
  source?: string | null
  provider?: string | null
  prompt?: string | null
  negative_prompt?: string | null
  alt?: string | null
  status: MediaVersionStatus | string
  parent_media_id?: string | null
  generation_job_id?: string | null
  created_at?: string | null
  activated_at?: string | null
  retired_at?: string | null
  public_url?: string | null
  synthetic?: boolean
}

export interface MediaInventoryCard {
  article: {
    id: string
    slug: string
    category: string
    title: string
    text_status: string
    disposition?: string | null
    updated_at: string
    published_at?: string | null
    image_filename?: string | null
    image_prompt?: string | null
    image_source?: string | null
    image_model?: string | null
    image_status?: string | null
    active_media_id?: string | null
    revision_count?: number
  }
  media_status: string
  live: ArticleMediaVersion | null
  candidates: ArticleMediaVersion[]
  versions: ArticleMediaVersion[]
  public_image_url: string | null
}

export interface MediaInventoryResponse {
  items: MediaInventoryCard[]
  next_cursor: string | null
  limit: number
}

export interface MediaGenerationJob {
  id: string
  article_id: string
  status: string
  provider?: string
  model?: string
  prompt?: string
  negative_prompt?: string | null
  candidate_count?: number
  progress?: number
  attempt?: number
  max_attempts?: number
  retryable?: boolean
  error_code?: string | null
  error_message?: string | null
  cost_usd?: number | null
  media_ids?: string[]
  created_at?: string
  finished_at?: string | null
}

export interface AdminApiClientOptions {
  /** Override for NEXT_PUBLIC_ADMIN_API_URL (mainly tests). */
  baseUrl?: string
  /** Override for the session-token lookup (mainly tests). */
  getToken?: () => Promise<string | null>
  /** Override for fetch (mainly tests). */
  fetchImpl?: typeof fetch
}

export interface AdminApiClient {
  listArticles(params?: ListArticlesParams): Promise<AdminArticleListResponse>
  getArticle(id: string): Promise<AdminArticle>
  updateArticle(
    id: string,
    patch: UpdateArticlePatch,
    expectedUpdatedAt: string,
    idempotencyKey?: string,
  ): Promise<AdminArticle>
  publishArticle(id: string, idempotencyKey?: string): Promise<PublishArticleResult>
  unpublishArticle(id: string, idempotencyKey?: string): Promise<PublishArticleResult>
  listMedia(params?: {
    cursor?: string
    limit?: number
    status?: string
    category?: string
    source?: string
    q?: string
  }): Promise<MediaInventoryResponse>
  getArticleMedia(articleId: string): Promise<{
    article: AdminArticle
    live: ArticleMediaVersion | null
    versions: ArticleMediaVersion[]
    jobs: MediaGenerationJob[]
  }>
  startMediaGeneration(
    articleId: string,
    body?: { prompt?: string; negative_prompt?: string; count?: number; presets?: string[] },
    idempotencyKey?: string,
  ): Promise<{ job: MediaGenerationJob }>
  uploadArticleMedia(
    articleId: string,
    body: { data_base64: string; mime?: string; alt?: string; prompt?: string },
    idempotencyKey?: string,
  ): Promise<{ media: ArticleMediaVersion }>
  assignMedia(
    articleId: string,
    mediaId: string,
    expectedUpdatedAt?: string,
    idempotencyKey?: string,
  ): Promise<{ item: AdminArticle; media: ArticleMediaVersion; purge_ok: boolean | null }>
  applyMediaAndPublish(
    articleId: string,
    mediaId: string,
    expectedUpdatedAt?: string,
    idempotencyKey?: string,
  ): Promise<{ item: AdminArticle; media: ArticleMediaVersion; purge_ok: boolean | null }>
  archiveMedia(
    articleId: string,
    mediaId: string,
    idempotencyKey?: string,
  ): Promise<{ media: ArticleMediaVersion; item: AdminArticle; purge_ok: boolean | null }>
  rollbackMedia(
    articleId: string,
    mediaId: string,
    expectedUpdatedAt?: string,
    idempotencyKey?: string,
  ): Promise<{ item: AdminArticle; media: ArticleMediaVersion; purge_ok: boolean | null }>
  getMediaJob(jobId: string): Promise<{ job: MediaGenerationJob; media: ArticleMediaVersion[] }>
  retryMediaJob(jobId: string, idempotencyKey?: string): Promise<{ job_id: string; status: string }>
}

const DEFAULT_SORT = 'updated_at.desc'

function resolveBaseUrl(explicit?: string): string {
  const raw = (explicit ?? process.env.NEXT_PUBLIC_ADMIN_API_URL ?? '').replace(/\/+$/, '')
  if (!raw) {
    throw new AdminApiError(
      0,
      'not_configured',
      'NEXT_PUBLIC_ADMIN_API_URL is not set — point it at the sovetydoma-admin-api worker URL',
    )
  }
  return raw
}

/** Default token source: the current Supabase session (lazy import so tests can inject). */
async function getSessionToken(): Promise<string | null> {
  const { getSupabase } = await import('@/lib/supabase')
  const { data } = await getSupabase().auth.getSession()
  return data.session?.access_token ?? null
}

/** The worker wraps single-row responses in `{ item: ... }`; tolerate a bare row too. */
function unwrapItem(payload: unknown): AdminArticle {
  if (payload && typeof payload === 'object' && 'item' in payload) {
    return (payload as { item: AdminArticle }).item
  }
  return payload as AdminArticle
}

function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function createAdminApiClient(options: AdminApiClientOptions = {}): AdminApiClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const getToken = options.getToken ?? getSessionToken

  async function request(
    path: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<unknown> {
    const baseUrl = resolveBaseUrl(options.baseUrl)
    const token = await getToken()
    if (!token) {
      throw new AdminApiError(401, 'not_authenticated', 'Нет активной сессии — войдите в аккаунт администратора')
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    }
    let body: string | undefined
    if (init.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(init.body)
    }
    let res: Response
    try {
      res = await fetchImpl(`${baseUrl}${path}`, { method: init.method ?? 'GET', headers, body })
    } catch (e) {
      throw new AdminApiError(0, 'network_error', e instanceof Error ? e.message : 'Network request failed')
    }
    let payload: unknown = null
    const text = await res.text()
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        // Non-JSON body (e.g. a proxy HTML error page) — fall through to status handling.
      }
    }
    if (!res.ok) {
      const errBody = (payload && typeof payload === 'object' ? payload : {}) as { error?: string; message?: string }
      throw new AdminApiError(
        res.status,
        errBody.error || `http_${res.status}`,
        errBody.message || `Request failed with status ${res.status}`,
      )
    }
    return payload
  }

  return {
    listArticles(params: ListArticlesParams = {}): Promise<AdminArticleListResponse> {
      const qs = new URLSearchParams()
      qs.set('page', String(params.page ?? 1))
      qs.set('per_page', String(params.per_page ?? 50))
      qs.set('status', params.status ?? '')
      qs.set('category', params.category ?? '')
      qs.set('q', params.q ?? '')
      qs.set('sort', params.sort ?? DEFAULT_SORT)
      return request(`/admin/articles?${qs.toString()}`) as Promise<AdminArticleListResponse>
    },

    async getArticle(id: string): Promise<AdminArticle> {
      return unwrapItem(await request(`/admin/articles/${encodeURIComponent(id)}`))
    },

    async updateArticle(
      id: string,
      patch: UpdateArticlePatch,
      expectedUpdatedAt: string,
      idempotencyKey: string = newIdempotencyKey(),
    ): Promise<AdminArticle> {
      const payload = (await request(`/admin/articles/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'X-Expected-Updated-At': expectedUpdatedAt,
          'Idempotency-Key': idempotencyKey,
        },
        body: patch,
      })) as { item: AdminArticle }
      return unwrapItem(payload)
    },

    async publishArticle(id: string, idempotencyKey: string = newIdempotencyKey()): Promise<PublishArticleResult> {
      const payload = (await request(`/admin/articles/${encodeURIComponent(id)}/publish`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
      })) as PublishArticleResult
      return { ...payload, item: unwrapItem(payload) }
    },

    async unpublishArticle(id: string, idempotencyKey: string = newIdempotencyKey()): Promise<PublishArticleResult> {
      const payload = (await request(`/admin/articles/${encodeURIComponent(id)}/unpublish`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
      })) as PublishArticleResult
      return { ...payload, item: unwrapItem(payload) }
    },

    listMedia(params = {}): Promise<MediaInventoryResponse> {
      const qs = new URLSearchParams()
      if (params.cursor) qs.set('cursor', params.cursor)
      qs.set('limit', String(params.limit ?? 30))
      if (params.status) qs.set('status', params.status)
      if (params.category) qs.set('category', params.category)
      if (params.source) qs.set('source', params.source)
      if (params.q) qs.set('q', params.q)
      return request(`/admin/media?${qs.toString()}`) as Promise<MediaInventoryResponse>
    },

    getArticleMedia(articleId: string) {
      return request(`/admin/articles/${encodeURIComponent(articleId)}/media`) as ReturnType<AdminApiClient['getArticleMedia']>
    },

    startMediaGeneration(articleId, body = {}, idempotencyKey = newIdempotencyKey()) {
      return request(`/admin/articles/${encodeURIComponent(articleId)}/media/generations`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body,
      }) as Promise<{ job: MediaGenerationJob }>
    },

    uploadArticleMedia(articleId, body, idempotencyKey = newIdempotencyKey()) {
      return request(`/admin/articles/${encodeURIComponent(articleId)}/media/uploads`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body,
      }) as Promise<{ media: ArticleMediaVersion }>
    },

    assignMedia(articleId, mediaId, expectedUpdatedAt, idempotencyKey = newIdempotencyKey()) {
      const headers: Record<string, string> = { 'Idempotency-Key': idempotencyKey }
      if (expectedUpdatedAt) headers['X-Expected-Updated-At'] = expectedUpdatedAt
      return request(
        `/admin/articles/${encodeURIComponent(articleId)}/media/${encodeURIComponent(mediaId)}/assign`,
        { method: 'POST', headers, body: {} },
      ) as ReturnType<AdminApiClient['assignMedia']>
    },

    applyMediaAndPublish(articleId, mediaId, expectedUpdatedAt, idempotencyKey = newIdempotencyKey()) {
      const headers: Record<string, string> = { 'Idempotency-Key': idempotencyKey }
      if (expectedUpdatedAt) headers['X-Expected-Updated-At'] = expectedUpdatedAt
      return request(
        `/admin/articles/${encodeURIComponent(articleId)}/media/${encodeURIComponent(mediaId)}/apply-and-publish`,
        { method: 'POST', headers, body: {} },
      ) as ReturnType<AdminApiClient['applyMediaAndPublish']>
    },

    archiveMedia(articleId, mediaId, idempotencyKey = newIdempotencyKey()) {
      return request(
        `/admin/articles/${encodeURIComponent(articleId)}/media/${encodeURIComponent(mediaId)}/archive`,
        { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: {} },
      ) as ReturnType<AdminApiClient['archiveMedia']>
    },

    rollbackMedia(articleId, mediaId, expectedUpdatedAt, idempotencyKey = newIdempotencyKey()) {
      const headers: Record<string, string> = { 'Idempotency-Key': idempotencyKey }
      if (expectedUpdatedAt) headers['X-Expected-Updated-At'] = expectedUpdatedAt
      return request(
        `/admin/articles/${encodeURIComponent(articleId)}/media/${encodeURIComponent(mediaId)}/rollback`,
        { method: 'POST', headers, body: {} },
      ) as ReturnType<AdminApiClient['rollbackMedia']>
    },

    getMediaJob(jobId: string) {
      return request(`/admin/media/jobs/${encodeURIComponent(jobId)}`) as ReturnType<AdminApiClient['getMediaJob']>
    },

    retryMediaJob(jobId: string, idempotencyKey = newIdempotencyKey()) {
      return request(`/admin/media/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: {},
      }) as ReturnType<AdminApiClient['retryMediaJob']>
    },
  }
}

// Module-level convenience functions (the house API): they build a default
// client per call, taking base URL from NEXT_PUBLIC_ADMIN_API_URL and the
// token from the current Supabase session.

export function listArticles(params: ListArticlesParams = {}): Promise<AdminArticleListResponse> {
  return createAdminApiClient().listArticles(params)
}

export function getArticle(id: string): Promise<AdminArticle> {
  return createAdminApiClient().getArticle(id)
}

export function updateArticle(
  id: string,
  patch: UpdateArticlePatch,
  expectedUpdatedAt: string,
  idempotencyKey?: string,
): Promise<AdminArticle> {
  return createAdminApiClient().updateArticle(id, patch, expectedUpdatedAt, idempotencyKey)
}

export function publishArticle(id: string, idempotencyKey?: string): Promise<PublishArticleResult> {
  return createAdminApiClient().publishArticle(id, idempotencyKey)
}

export function unpublishArticle(id: string, idempotencyKey?: string): Promise<PublishArticleResult> {
  return createAdminApiClient().unpublishArticle(id, idempotencyKey)
}

export function listMedia(
  params?: Parameters<AdminApiClient['listMedia']>[0],
): Promise<MediaInventoryResponse> {
  return createAdminApiClient().listMedia(params)
}

export function getArticleMedia(articleId: string) {
  return createAdminApiClient().getArticleMedia(articleId)
}

export function startMediaGeneration(
  articleId: string,
  body?: { prompt?: string; negative_prompt?: string; count?: number; presets?: string[] },
  idempotencyKey?: string,
) {
  return createAdminApiClient().startMediaGeneration(articleId, body, idempotencyKey)
}

export function uploadArticleMedia(
  articleId: string,
  body: { data_base64: string; mime?: string; alt?: string; prompt?: string },
  idempotencyKey?: string,
) {
  return createAdminApiClient().uploadArticleMedia(articleId, body, idempotencyKey)
}

export function assignMedia(
  articleId: string,
  mediaId: string,
  expectedUpdatedAt?: string,
  idempotencyKey?: string,
) {
  return createAdminApiClient().assignMedia(articleId, mediaId, expectedUpdatedAt, idempotencyKey)
}

export function applyMediaAndPublish(
  articleId: string,
  mediaId: string,
  expectedUpdatedAt?: string,
  idempotencyKey?: string,
) {
  return createAdminApiClient().applyMediaAndPublish(articleId, mediaId, expectedUpdatedAt, idempotencyKey)
}

export function archiveMedia(articleId: string, mediaId: string, idempotencyKey?: string) {
  return createAdminApiClient().archiveMedia(articleId, mediaId, idempotencyKey)
}

export function rollbackMedia(
  articleId: string,
  mediaId: string,
  expectedUpdatedAt?: string,
  idempotencyKey?: string,
) {
  return createAdminApiClient().rollbackMedia(articleId, mediaId, expectedUpdatedAt, idempotencyKey)
}

export function getMediaJob(jobId: string) {
  return createAdminApiClient().getMediaJob(jobId)
}

export function retryMediaJob(jobId: string, idempotencyKey?: string) {
  return createAdminApiClient().retryMediaJob(jobId, idempotencyKey)
}
