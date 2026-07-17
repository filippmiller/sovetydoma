// VK ID OAuth 2.1 (PKCE) helper to mint a USER token with wall+photos+groups.
// Public-client PKCE flow — no client_secret needed.
//
//   node scripts/vk-id-pkce.mjs start
//     -> prints the authorize URL. Open it, authorize, you'll be redirected to
//        the callback with ?code=...&device_id=...&state=...
//   node scripts/vk-id-pkce.mjs finish "<code>" "<device_id>" "<state>"
//     -> exchanges the code and writes the user token to .vk-user-token.local.json
//
// Persists the PKCE verifier + state in .vk-pkce.local.json between the two steps.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.join(here, '..', '.vk-pkce.local.json')
const TOKEN_FILE = path.join(here, '..', '.vk-user-token.local.json')

// No fallback: pass the app id explicitly. Using a stale hardcoded id here once
// pointed this flow at the wrong VK app (see bead sovetydoma-1fc).
const APP_ID = process.env.VK_ID_APP_ID
if (!APP_ID) {
  console.error('VK_ID_APP_ID env var is required (example: VK_ID_APP_ID=54626241 node scripts/vk-id-pkce.mjs start)')
  process.exit(1)
}
const REDIRECT_URI = process.env.VK_ID_REDIRECT_URI || 'https://1001sovet.ru/api/auth/vk/callback'
const SCOPE = 'wall photos groups offline'
const AUTH_BASE = 'https://id.vk.com'

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const mode = process.argv[2]

if (mode === 'start') {
  const codeVerifier = b64url(crypto.randomBytes(64))
  const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest())
  const state = b64url(crypto.randomBytes(16))
  fs.writeFileSync(STATE_FILE, JSON.stringify({ codeVerifier, state }, null, 2))

  const u = new URL(`${AUTH_BASE}/authorize`)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', APP_ID)
  u.searchParams.set('scope', SCOPE)
  u.searchParams.set('redirect_uri', REDIRECT_URI)
  u.searchParams.set('state', state)
  u.searchParams.set('code_challenge', codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  console.log('AUTHORIZE_URL:')
  console.log(u.toString())
} else if (mode === 'finish') {
  const code = process.argv[3]
  const deviceId = process.argv[4]
  const state = process.argv[5]
  if (!code || !deviceId) { console.error('usage: finish "<code>" "<device_id>" ["<state>"]'); process.exit(1) }
  const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  if (state && saved.state && state !== saved.state) {
    console.error(`state mismatch (got ${state}, expected ${saved.state})`); process.exit(1)
  }
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', code)
  body.set('code_verifier', saved.codeVerifier)
  body.set('client_id', APP_ID)
  body.set('device_id', deviceId)
  body.set('redirect_uri', REDIRECT_URI)

  const res = await fetch(`${AUTH_BASE}/oauth2/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    console.error('EXCHANGE FAILED:', JSON.stringify(data))
    process.exit(1)
  }
  const token = data.access_token
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({
    access_token: token,
    expires_in: data.expires_in,
    user_id: data.user_id,
    scope: data.scope,
    refresh_token: data.refresh_token,
  }, null, 2))
  console.log('OK. token scope:', data.scope, '| expires_in:', data.expires_in, '| user_id:', data.user_id)
  console.log('written to', path.basename(TOKEN_FILE))
} else {
  console.error('usage: vk-id-pkce.mjs start | finish "<code>" "<device_id>" "<state>"')
  process.exit(1)
}
