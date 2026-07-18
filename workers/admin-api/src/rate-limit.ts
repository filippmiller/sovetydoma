/**
 * Simple fixed-window rate limiter for mutating admin requests, keyed by
 * actor_id (the authenticated admin user's uuid).
 *
 * LIMITATION (documented, accepted): the window lives in isolate memory.
 * Cloudflare runs many isolates, so the effective global limit can exceed
 * the configured cap, and windows reset when an isolate is evicted. This is
 * an abuse tripwire, not a strict guarantee — for strict guarantees move to
 * KV or Durable Objects later.
 */

interface Bucket {
  windowStart: number
  count: number
}

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 60_000

export function checkMutationRateLimit(actorId: string, maxPerMinute = 60, now = Date.now()): boolean {
  const bucket = buckets.get(actorId)
  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(actorId, { windowStart: now, count: 1 })
  } else {
    bucket.count += 1
  }

  // Opportunistic cleanup so the map cannot grow unbounded.
  if (buckets.size > 1000) {
    for (const [key, value] of buckets) {
      if (now - value.windowStart >= WINDOW_MS) buckets.delete(key)
    }
  }

  return (buckets.get(actorId)?.count ?? 0) <= maxPerMinute
}
