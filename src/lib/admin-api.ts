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
