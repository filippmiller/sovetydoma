import type { Env } from '../types'
import { fetchWithTimeout } from '../http'

const DEFAULT_VK_ID_AUTH_BASE = 'https://id.vk.com'

export type VkIdExchangeInput = {
  code: string
  deviceId: string
  codeVerifier: string
  state: string
}

type VkTokenResponse = {
  access_token?: string
  refresh_token?: string
  id_token?: string
  token_type?: string
  expires_in?: number
  user_id?: number | string
  email?: string
  state?: string
  error?: string
  error_description?: string
}

type VkUserInfoResponse = {
  user?: {
    user_id?: string | number
    id?: string | number
    first_name?: string
    last_name?: string
    avatar?: string
    photo_200?: string
    email?: string
  }
  email?: string
  error?: string
  error_description?: string
}

type SupabaseGenerateLinkResponse = {
  action_link?: string
  id?: string
  email?: string
}

function cleanText(value: unknown, max = 300): string {
  return String(value || '').trim().replace(/[\r\n]/g, '').slice(0, max)
}

function cleanEmail(value: unknown): string {
  return cleanText(value, 320).toLowerCase()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function fallbackEmailForVkUser(vkUserId: string): string {
  const safeId = vkUserId.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 80)
  return `vk-${safeId}@users.1001sovet.ru`
}

function vkIdAuthBase(env: Env): string {
  return String(env.VK_ID_AUTH_BASE_URL || DEFAULT_VK_ID_AUTH_BASE).replace(/\/+$/, '')
}

function vkIdAppId(env: Env): string {
  // Fail closed: no hardcoded fallback app id. The canonical VK ID app lives in
  // wrangler.toml [vars]; if it is missing, requireVkIdConfig reports the
  // provider as unconfigured instead of silently using a stale/foreign app.
  return cleanText(env.VK_ID_APP_ID, 32)
}

function vkIdRedirectUri(env: Env): string {
  return cleanText(env.VK_ID_REDIRECT_URI || `${String(env.PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')}/api/auth/vk/callback`, 500)
}

function supabaseBase(env: Env): string {
  return String(env.SUPABASE_URL || '').replace(/\/+$/, '')
}

function requireVkIdConfig(env: Env): string[] {
  const missing: string[] = []
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!vkIdAppId(env)) missing.push('VK_ID_APP_ID')
  return missing
}

async function postForm<T>(url: string, body: URLSearchParams): Promise<T> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({})) as T & { error?: string; error_description?: string }
  if (!res.ok || data.error) {
    throw new Error([data.error || `http_${res.status}`, data.error_description].filter(Boolean).join(': '))
  }
  return data as T
}

export async function exchangeVkIdCode(env: Env, input: VkIdExchangeInput): Promise<VkTokenResponse> {
  // VK ID's official Web SDK sends every exchange parameter except `code`
  // in the query string. The endpoint does not treat an all-form-body request
  // as equivalent, so mirror that wire format exactly.
  const endpoint = new URL(`${vkIdAuthBase(env)}/oauth2/auth`)
  endpoint.searchParams.set('grant_type', 'authorization_code')
  endpoint.searchParams.set('redirect_uri', vkIdRedirectUri(env))
  endpoint.searchParams.set('client_id', vkIdAppId(env))
  endpoint.searchParams.set('code_verifier', input.codeVerifier)
  endpoint.searchParams.set('state', input.state)
  endpoint.searchParams.set('device_id', input.deviceId)
  const body = new URLSearchParams()
  body.set('code', input.code)
  // A confidential-client secret, when configured, stays in the request body
  // so it cannot leak through URLs, proxy logs, or tracing metadata.
  if (env.VK_ID_CLIENT_SECRET) {
    body.set('client_secret', env.VK_ID_CLIENT_SECRET)
  }
  return postForm<VkTokenResponse>(endpoint.toString(), body)
}

export async function fetchVkIdUserInfo(env: Env, accessToken: string): Promise<VkUserInfoResponse> {
  const endpoint = new URL(`${vkIdAuthBase(env)}/oauth2/user_info`)
  endpoint.searchParams.set('client_id', vkIdAppId(env))
  const body = new URLSearchParams()
  body.set('access_token', accessToken)
  if (env.VK_ID_CLIENT_SECRET) {
    body.set('client_secret', env.VK_ID_CLIENT_SECRET)
  }
  return postForm<VkUserInfoResponse>(endpoint.toString(), body)
}

export async function generateSupabaseMagicLink(env: Env, email: string, userData: Record<string, unknown>): Promise<string> {
  const res = await fetchWithTimeout(`${supabaseBase(env)}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY || '',
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'magiclink',
      email,
      data: userData,
      redirect_to: `${String(env.PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')}/moy-kabinet/`,
    }),
  })
  const data = await res.json().catch(() => ({})) as SupabaseGenerateLinkResponse & { code?: string; msg?: string; message?: string }
  if (!res.ok || !data.action_link) {
    throw new Error(data.code || data.msg || data.message || `supabase_generate_link_${res.status}`)
  }
  return data.action_link
}

export async function createSupabaseVkIdLoginLink(env: Env, input: VkIdExchangeInput): Promise<{ actionLink: string; email: string; vkUserId: string }> {
  const missing = requireVkIdConfig(env)
  if (missing.length > 0) {
    const err = new Error('provider_unconfigured')
    ;(err as Error & { missing?: string[] }).missing = missing
    throw err
  }

  const token = await exchangeVkIdCode(env, input)
  const returnedState = cleanText(token.state, 300)
  if (returnedState !== input.state) throw new Error('vk_token_state_mismatch')
  const accessToken = cleanText(token.access_token, 2000)
  if (!accessToken) throw new Error('vk_access_token_missing')

  const info = await fetchVkIdUserInfo(env, accessToken)
  const user = info.user || {}
  const vkUserId = cleanText(user.user_id || user.id || token.user_id, 80)
  if (!vkUserId) throw new Error('vk_user_id_missing')

  const emailFromVk = cleanEmail(info.email || user.email || token.email)
  const email = isValidEmail(emailFromVk) ? emailFromVk : fallbackEmailForVkUser(vkUserId)
  const displayName = [user.first_name, user.last_name].map((v) => cleanText(v, 80)).filter(Boolean).join(' ').trim() || email.split('@')[0]
  const avatarUrl = cleanText(user.avatar || user.photo_200, 500)
  const actionLink = await generateSupabaseMagicLink(env, email, {
    provider: 'vk_id',
    vk_id: vkUserId,
    vk_email_missing: !isValidEmail(emailFromVk),
    display_name: displayName,
    avatar_url: avatarUrl || undefined,
  })

  return { actionLink, email, vkUserId }
}
