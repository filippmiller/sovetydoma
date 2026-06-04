interface RateLimitEnv {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY?: string
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
