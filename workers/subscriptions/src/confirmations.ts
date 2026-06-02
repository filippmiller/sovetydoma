import type { DirectChannel } from './types'
import { createSecureToken, sha256Hex } from './security'

export async function createConfirmation(channel: DirectChannel): Promise<{ channel: DirectChannel; token: string; tokenHash: string; expiresAt: string }> {
  const token = createSecureToken(channel)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()
  return {
    channel,
    token,
    tokenHash: await sha256Hex(token),
    expiresAt,
  }
}

export { createSecureToken, createSignedContactToken, sha256Hex, verifySignedContactToken } from './security'
