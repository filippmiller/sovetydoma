import type { Env } from './types'
import { callRpc } from './supabase'

export type RateLimitResult = {
  allowed: boolean
  bucket: string
  retryAfterSeconds?: number
}

export async function checkRateLimit(
  env: Env,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  return callRpc<RateLimitResult>(env, 'notification_check_rate_limit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
}
