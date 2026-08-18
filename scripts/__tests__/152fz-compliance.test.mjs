import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('consent_events migration is append-only: RLS on, no write grant for anon/authenticated', () => {
  const migration = read('supabase/migrations/202608181200_consent_events.sql')

  assert.match(migration, /create table if not exists public\.consent_events/)
  assert.match(migration, /alter table public\.consent_events enable row level security/)
  // Per this project's convention (202606101400_harden_rls_and_rate_limit_grants.sql),
  // RLS-enabled + zero write policy = implicit deny for anon/authenticated;
  // service_role bypasses RLS. Assert there is no policy granting INSERT/UPDATE/DELETE
  // to anon or authenticated — the only policy present must be the owner-only SELECT.
  assert.doesNotMatch(migration, /for (insert|update|delete|all) to (authenticated|anon)/i)
  assert.match(migration, /for select to authenticated using \(auth\.uid\(\) = subject_user_id\)/)
})

test('erasure_requests migration: RLS on, owner can only read (writes go through the service-role worker)', () => {
  const migration = read('supabase/migrations/202608181210_erasure_requests.sql')

  assert.match(migration, /create table if not exists public\.erasure_requests/)
  assert.match(migration, /alter table public\.erasure_requests enable row level security/)
  assert.doesNotMatch(migration, /for (insert|update|delete|all) to (authenticated|anon)/i)
  assert.match(migration, /for select to authenticated using \(auth\.uid\(\) = user_id\)/)
  assert.match(migration, /erasure_requests_one_pending_per_user/)
})

test('legal document versions are fixed constants, not a runtime-computed year', () => {
  const versions = read('src/lib/legal/document-versions.ts')
  const privacy = read('src/app/privacy/page.tsx')
  const terms = read('src/app/terms/page.tsx')

  assert.match(versions, /export const TERMS_VERSION = '\d{4}-\d{2}-\d{2}'/)
  assert.match(versions, /export const PRIVACY_POLICY_VERSION = '\d{4}-\d{2}-\d{2}'/)

  assert.doesNotMatch(privacy, /new Date\(\)\.getFullYear\(\)/)
  assert.doesNotMatch(terms, /new Date\(\)\.getFullYear\(\)/)
  assert.match(privacy, /PRIVACY_POLICY_VERSION/)
  assert.match(terms, /TERMS_VERSION/)
})

test('registration has two separate purpose-named consent checkboxes, not one bundled checkbox', () => {
  const registerForm = read('src/components/auth/RegisterForm.tsx')
  const authModal = read('src/components/auth/AuthModal.tsx')

  // Two distinct checkbox inputs.
  assert.match(registerForm, /id="terms"[\s\S]*?required/)
  assert.match(registerForm, /id="privacyConsent"[\s\S]*?required/)
  // Each labeled with a single purpose, not "Условия ... и Политика ..." bundled together.
  const termsLabel = registerForm.match(/<label htmlFor="terms"[\s\S]*?<\/label>/)?.[0] || ''
  assert.doesNotMatch(termsLabel, /Политик/)
  const privacyLabel = registerForm.match(/<label htmlFor="privacyConsent"[\s\S]*?<\/label>/)?.[0] || ''
  assert.match(privacyLabel, /персональных данных/)

  // Both required to submit, and both are independently checked before signUp.
  assert.match(authModal, /form\.get\('terms'\) === 'accepted'/)
  assert.match(authModal, /form\.get\('privacyConsent'\) === 'accepted'/)
  assert.match(authModal, /if \(!termsAccepted\)/)
  assert.match(authModal, /if \(!privacyConsentAccepted\)/)

  // Consent is written for both purposes after a successful signUp, never before/without one.
  assert.match(authModal, /submitSignupConsent\(newUserId, 'terms'\)/)
  assert.match(authModal, /submitSignupConsent\(newUserId, 'privacy_policy'\)/)
})

test('contact form requires its own PD-processing consent checkbox, client and server side', () => {
  const contactForm = read('src/components/ContactDeveloperForm.tsx')
  const worker = read('workers/photo-upload/src/index.ts')

  assert.match(contactForm, /name="pdConsent"/)
  assert.match(contactForm, /if \(!pdConsent\)/)
  assert.match(contactForm, /pdConsent,/)

  // Server enforces it too — the endpoint is public, so the UI checkbox alone isn't enough.
  assert.match(worker, /if \(payload\.pdConsent !== true\) return json\(\{ error: 'consent_required' \}/)
})

test('moy-kabinet exposes a self-service erasure panel', () => {
  const cabinet = read('src/app/moy-kabinet/page.tsx')
  const panel = read('src/components/account/ErasureRequestPanel.tsx')

  assert.match(cabinet, /import ErasureRequestPanel from '@\/components\/account\/ErasureRequestPanel'/)
  assert.match(cabinet, /tab === 'privacy' && <ErasureRequestPanel \/>/)
  assert.match(panel, /requestErasure\(\)/)
  assert.match(panel, /cancelErasure\(\)/)
})

test('retention cron is wired and scoped to erasure finalization (no invented lead-storage table)', () => {
  const wrangler = read('workers/photo-upload/wrangler.toml')
  const worker = read('workers/photo-upload/src/index.ts')

  assert.match(wrangler, /\[triggers\]\r?\ncrons = \["0 3 \* \* \*"\]/)
  assert.match(worker, /async scheduled\(_event: ScheduledEvent, env: Env\): Promise<void>/)
  assert.match(worker, /finalizeErasureRequests\(env\)/)
})
