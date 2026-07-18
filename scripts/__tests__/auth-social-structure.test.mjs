import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Structural guarantees for the 2026-07 auth overhaul:
// - one social-auth section (no duplicate/dead provider buttons)
// - no stale VK app id anywhere (fail-closed, canonical id comes from env)
// - VK ID runs the SDK-less PKCE redirect flow with a CSRF state check
// - the dialog is accessible and fits small viewports

const authModal = readFileSync('src/components/auth/AuthModal.tsx', 'utf8')
const authButton = readFileSync('src/components/auth/AuthButton.tsx', 'utf8')
const loginForm = readFileSync('src/components/auth/LoginForm.tsx', 'utf8')
const registerForm = readFileSync('src/components/auth/RegisterForm.tsx', 'utf8')
const socialSection = readFileSync('src/components/auth/SocialAuthSection.tsx', 'utf8')
const authCss = readFileSync('src/components/auth/auth.module.css', 'utf8')
const vkWorker = readFileSync('workers/subscriptions/src/auth/vk-id.ts', 'utf8')
const vkCallbackPage = readFileSync('public/api/auth/vk/callback/index.html', 'utf8')
const deployYml = readFileSync('.github/workflows/deploy.yml', 'utf8')
const pkceScript = readFileSync('workers/subscriptions/scripts/vk-id-pkce.mjs', 'utf8')
const wranglerToml = readFileSync('workers/subscriptions/wrangler.toml', 'utf8')

test('obsolete VK app id 54626241 is gone from runtime code and CI (fail closed)', () => {
  for (const [name, src] of Object.entries({ authModal, vkWorker, deployYml, pkceScript })) {
    assert.ok(!src.includes('54626241'), `${name} still references the obsolete VK app id`)
  }
})

test('canonical VK app id 54625895 is configured in the worker vars', () => {
  assert.match(wranglerToml, /VK_ID_APP_ID = "54625895"/)
})

test('no duplicate/fake VK button via Supabase OAuth remains', () => {
  assert.doesNotMatch(authModal, /signInWithOAuth\(\{[^}]*provider:\s*['"]vk['"]/s)
  assert.doesNotMatch(authModal, /provider:\s*provider/)
  assert.doesNotMatch(loginForm, /Войти через VK/)
  assert.doesNotMatch(loginForm, /OAuthButton/)
})

test('VK ID uses the redirect PKCE flow, not the OneTap SDK widget', () => {
  assert.doesNotMatch(authModal, /VKIDSDK/)
  assert.doesNotMatch(authModal, /unpkg\.com\/@vkid/)
  assert.doesNotMatch(authModal, /oauthList/)
  assert.doesNotMatch(authModal, /showAlternativeLogin/)
  assert.match(authModal, /id\.vk\.com\/authorize/)
  assert.match(authModal, /code_challenge_method['"]?,\s*['"]S256['"]/s)
})

test('social section offers the two primary providers with uniform copy', () => {
  assert.match(socialSection, /Продолжить с VK ID/)
  assert.match(socialSection, /Продолжить с Яндекс ID/)
  assert.match(socialSection, /Продолжить с Google/)
  // Real SVG brand icons, not glued text pseudo-icons ("ЯВойти", "GВойти", "VKВойти")
  assert.match(socialSection, /<svg/)
  assert.doesNotMatch(socialSection, /['"]Я['"]|['"]G['"]|['"]VK['"]/)
  // Loading states are labelled per provider
  assert.match(socialSection, /loadingProvider === 'vk'/)
  assert.match(socialSection, /loadingProvider === 'yandex'/)
  assert.match(socialSection, /loadingProvider === 'google'/)
})

test('social auth is available in the registration tab too (single implementation)', () => {
  const registerBlock = authModal.match(/\{!success && tab === 'register' && \(([\s\S]*?)\)\}/)
  assert.ok(registerBlock, 'register block not found')
  assert.match(registerBlock[1], /\{socialSection\}/)
})

test('VK callback page enforces the CSRF state and allowlists both trusted Supabase auth origins', () => {
  assert.match(vkCallbackPage, /sovetydoma_vk_oauth_state/)
  assert.match(vkCallbackPage, /state_mismatch/)
  assert.match(vkCallbackPage, /state:\s*returnedState/)
  assert.match(vkCallbackPage, /allowedActionLinkOrigins/)
  assert.match(vkCallbackPage, /https:\/\/api\.1001sovet\.ru/)
  assert.match(vkCallbackPage, /https:\/\/plwkjdpuxjkmpkqiqzkk\.supabase\.co/)
  assert.match(vkCallbackPage, /target\.pathname\.indexOf\('\/auth\/v1\/'\) === 0/)
})

test('captured Supabase magic-link tokens establish a session and land in the cabinet', () => {
  assert.doesNotMatch(authButton, /if \(!hash\.includes\('type=recovery'\)\) return/)
  assert.match(authButton, /const isRecovery = params\.get\('type'\) === 'recovery'/)
  assert.match(authButton, /auth\.setSession\(\{ access_token, refresh_token \}\)/)
  assert.match(authButton, /error \|\| !data\.session/)
  assert.match(authButton, /clearAuthHash\(\)/)
  assert.match(authButton, /window\.location\.replace\('\/moy-kabinet\/'\)/)
})

test('auth dialog is accessible and fits small viewports', () => {
  assert.match(authModal, /role="dialog"/)
  assert.match(authModal, /aria-modal="true"/)
  assert.match(authModal, /aria-labelledby="auth-modal-title"/)
  assert.match(authModal, /aria-describedby="auth-modal-desc"/)
  assert.match(authModal, /e\.key === 'Escape'/)
  assert.match(authCss, /max-height:\s*calc\(100dvh - 2rem\)/)
  assert.match(authCss, /overflow-y:\s*auto/)
  assert.match(authCss, /@media \(max-width: 480px\)/)
  assert.match(authCss, /:focus-visible/)
})

test('unverified social proof ("500+ читателей") is removed', () => {
  assert.doesNotMatch(authModal, /500\+/)
  assert.doesNotMatch(authModal, /читателей/)
})

test('email login and registration forms are still rendered', () => {
  assert.match(loginForm, /name="email"/)
  assert.match(loginForm, /name="password"/)
  assert.match(registerForm, /name="displayName"/)
  assert.match(registerForm, /name="terms"/)
  assert.match(authModal, /signInWithPassword/)
  assert.match(authModal, /signUp/)
})
