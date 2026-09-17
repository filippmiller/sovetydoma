interface RateLimitEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

interface KvRateLimitEnv {
  RATE_LIMIT_KV?: KVNamespace
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function base64Url(bytes: Uint8Array): string {
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function buildRateLimitBucket(scope: string, ip: string, partition = ''): Promise<string> {
  const material = `${scope}\n${ip || 'unknown'}\n${partition}`
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material)))
  return `${scope}:${base64Url(digest)}`
}

/**
 * Generic KV-backed per-IP rate limiter for the 152-FZ account routes
 * (/consent, /account/erasure/*). Same fail-open-on-KV-outage shape as
 * contact.ts's rateLimitContact, kept as a separate small function (rather
 * than generalizing rateLimitContact itself) to avoid touching that already-
 * working, unrelated code path.
 */
export async function rateLimitKv(
  env: KvRateLimitEnv,
  scope: string,
  ip: string,
  maxHits: number,
  windowSeconds: number,
): Promise<boolean> {
  const kv = env.RATE_LIMIT_KV
  if (!kv) return true

  const safeIp = ip.replace(/[^a-zA-Z0-9.:_-]/g, '_').slice(0, 64)
  const key = `${scope}-rl:${safeIp}`

  try {
    const count = Number((await kv.get(key)) ?? '0')
    if (count >= maxHits) return false
    await kv.put(key, String(count + 1), { expirationTtl: windowSeconds })
    return true
  } catch (err) {
    console.error(`[rateLimitKv:${scope}] KV error — failing open:`, err)
    return true
  }
}

export async function checkIngestionRateLimit({
  env,
  bucketKey,
  windowSeconds,
  maxHits,
  fetcher = fetch,
}: {
  env: RateLimitEnv
  bucketKey: string
  windowSeconds: number
  maxHits: number
  fetcher?: Fetcher
}): Promise<boolean> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return false

  try {
    const res = await fetcher(`${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/check_ingestion_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bucket_key: bucketKey,
        window_seconds: windowSeconds,
        max_hits: maxHits,
      }),
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => null) as null | boolean | { allowed?: unknown }
    if (typeof data === 'boolean') return data
    return data?.allowed === true
  } catch {
    return false
  }
}
