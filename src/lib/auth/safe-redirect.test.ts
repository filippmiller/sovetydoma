import assert from 'node:assert/strict'
import test from 'node:test'
import { assertSupabaseAuthLink } from './safe-redirect'

// Open-redirect guard for the worker-supplied Supabase action links.

const SUPABASE = 'https://supabase.example'

function withEnv(value: string | undefined, fn: () => void) {
  const prev = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (value === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = value
  try {
    fn()
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prev
  }
}

test('safe redirect: accepts the Supabase verify action link', () => {
  withEnv(SUPABASE, () => {
    assert.equal(assertSupabaseAuthLink(`${SUPABASE}/auth/v1/verify?token=abc&type=magiclink`), true)
  })
})

test('safe redirect: accepts the prefix with a trailing-slash-less env value', () => {
  withEnv(`${SUPABASE}/`, () => {
    assert.equal(assertSupabaseAuthLink(`${SUPABASE}/auth/v1/verify?token=abc`), true)
  })
})

test('safe redirect: rejects external phishing URLs', () => {
  withEnv(SUPABASE, () => {
    assert.equal(assertSupabaseAuthLink('https://evil.example/steal?token=abc'), false)
    assert.equal(assertSupabaseAuthLink(`https://supabase.example.evil.com/auth/v1/verify?token=abc`), false)
  })
})

test('safe redirect: rejects same-origin-looking but non-auth paths', () => {
  withEnv(SUPABASE, () => {
    assert.equal(assertSupabaseAuthLink(`${SUPABASE}/rest/v1/users`), false)
    assert.equal(assertSupabaseAuthLink(`${SUPABASE}/auth/v2/verify?token=abc`), false)
  })
})

test('safe redirect: rejects javascript:/data: and protocol-relative URLs', () => {
  withEnv(SUPABASE, () => {
    assert.equal(assertSupabaseAuthLink('javascript:alert(1)'), false)
    assert.equal(assertSupabaseAuthLink('data:text/html,<script>1</script>'), false)
    assert.equal(assertSupabaseAuthLink(`//supabase.example/auth/v1/verify`), false)
  })
})

test('safe redirect: fail-closed when NEXT_PUBLIC_SUPABASE_URL is not set', () => {
  withEnv(undefined, () => {
    assert.equal(assertSupabaseAuthLink(`${SUPABASE}/auth/v1/verify?token=abc`), false)
  })
  withEnv('', () => {
    assert.equal(assertSupabaseAuthLink(`${SUPABASE}/auth/v1/verify?token=abc`), false)
  })
})
