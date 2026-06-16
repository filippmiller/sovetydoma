import type { Env } from '../types'
import { generateSupabaseMagicLink } from './vk-id'
import { fetchWithTimeout } from '../http'

// Custom Yandex OAuth flow (bead sovetydoma-gsk). Self-hosted Supabase Auth does
// not support a `yandex` provider, so we run the authorization-code exchange here
// (server-side, with the client secret) and bridge the Yandex identity into a
// Supabase session by minting an admin magiclink for the user's email — exactly
// the pattern used for VK ID in vk-id.ts.

const YANDEX_OAUTH_TOKEN_URL = 'https://oauth.yandex.ru/token'
const YANDEX_USER_INFO_URL = 'https://login.yandex.ru/info?format=json'

export type YandexExchangeInput = {
  code: string
}

type YandexTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  error?: string
  error_description?: string
}

type YandexUserInfoResponse = {
  id?: string
  login?: string
  default_email?: string
  emails?: string[]
  display_name?: string
  real_name?: string
  first_name?: string
  last_name?: string
  default_avatar_id?: string
  is_avatar_empty?: boolean
  error?: string
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

function fallbackEmailForYandexUser(yandexId: string): string {
  const safeId = yandexId.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 80)
  return `yandex-${safeId}@users.1001sovet.ru`
}

export function requireYandexConfig(env: Env): string[] {
  const missing: string[] = []
  if (!env.SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!env.YANDEX_OAUTH_CLIENT_ID) missing.push('YANDEX_OAUTH_CLIENT_ID')
  if (!env.YANDEX_OAUTH_CLIENT_SECRET) missing.push('YANDEX_OAUTH_CLIENT_SECRET')
  return missing
}

function yandexRedirectUri(env: Env): string {
  // Server-side derivation: use the explicit env var if set, else construct from
  // PUBLIC_SITE_URL. Never accept this value from the client (M2 fix).
  const explicit = String(env.YANDEX_OAUTH_REDIRECT_URI || '').trim()
  if (explicit) return explicit
  const siteOrigin = String(env.PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')
  return `${siteOrigin}/auth/callback/`
}

async function exchangeYandexCode(env: Env, input: YandexExchangeInput): Promise<YandexTokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', input.code)
  body.set('client_id', cleanText(env.YANDEX_OAUTH_CLIENT_ID, 200))
  body.set('client_secret', cleanText(env.YANDEX_OAUTH_CLIENT_SECRET, 200))
  // redirect_uri is optional for Yandex but, when the app is configured with one,
  // it must match. Derived server-side from env — never from the client request.
  const redirectUri = yandexRedirectUri(env)
  if (redirectUri) body.set('redirect_uri', redirectUri)

  const res = await fetchWithTimeout(YANDEX_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({})) as YandexTokenResponse
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error || `yandex_token_http_${res.status}`)
  }
  return data
}

async function fetchYandexUserInfo(accessToken: string): Promise<YandexUserInfoResponse> {
  const res = await fetchWithTimeout(YANDEX_USER_INFO_URL, {
    headers: { Authorization: `OAuth ${accessToken}` },
  })
  const data = await res.json().catch(() => ({})) as YandexUserInfoResponse
  if (!res.ok || data.error || !data.id) {
    throw new Error(data.error || `yandex_userinfo_http_${res.status}`)
  }
  return data
}

function yandexAvatarUrl(info: YandexUserInfoResponse): string {
  if (info.is_avatar_empty || !info.default_avatar_id) return ''
  return `https://avatars.yandex.net/get-yapic/${cleanText(info.default_avatar_id, 80)}/islands-200`
}

export async function createSupabaseYandexLoginLink(env: Env, input: YandexExchangeInput): Promise<{ actionLink: string; email: string; yandexId: string }> {
  const missing = requireYandexConfig(env)
  if (missing.length > 0) {
    const err = new Error('provider_unconfigured')
    ;(err as Error & { missing?: string[] }).missing = missing
    throw err
  }

  const token = await exchangeYandexCode(env, input)
  const accessToken = cleanText(token.access_token, 4000)
  if (!accessToken) throw new Error('yandex_access_token_missing')

  const info = await fetchYandexUserInfo(accessToken)
  const yandexId = cleanText(info.id, 80)
  if (!yandexId) throw new Error('yandex_user_id_missing')

  const emailFromYandex = cleanEmail(info.default_email || (info.emails && info.emails[0]))
  const email = isValidEmail(emailFromYandex) ? emailFromYandex : fallbackEmailForYandexUser(yandexId)
  const displayName = cleanText(info.display_name || info.real_name, 80)
    || [info.first_name, info.last_name].map((v) => cleanText(v, 80)).filter(Boolean).join(' ').trim()
    || cleanText(info.login, 80)
    || email.split('@')[0]
  const avatarUrl = yandexAvatarUrl(info)

  const actionLink = await generateSupabaseMagicLink(env, email, {
    provider: 'yandex',
    yandex_id: yandexId,
    yandex_email_missing: !isValidEmail(emailFromYandex),
    display_name: displayName,
    avatar_url: avatarUrl || undefined,
  })

  return { actionLink, email, yandexId }
}
