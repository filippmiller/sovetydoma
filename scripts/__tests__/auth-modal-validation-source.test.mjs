import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// The per-mode form JSX lives in dedicated presentational components
// (LoginForm/RegisterForm), while the submit handlers + cross-cutting state
// (FormData parsing, termsAccepted) remain in the AuthModal parent.
const authModalSource = readFileSync('src/components/auth/AuthModal.tsx', 'utf8')
const loginFormSource = readFileSync('src/components/auth/LoginForm.tsx', 'utf8')
const registerFormSource = readFileSync('src/components/auth/RegisterForm.tsx', 'utf8')
const passwordInputSource = readFileSync('src/components/auth/PasswordInput.tsx', 'utf8')

test('login form submits the same fields that the user edits', () => {
  assert.match(loginFormSource, /name="email"/)
  assert.match(loginFormSource, /value=\{email\}/)
  assert.doesNotMatch(loginFormSource, /value=\{registerEmail\}/)
  assert.match(loginFormSource, /name="password"/)
  // Submit handlers (which read the edited fields) stay in the parent.
  assert.match(authModalSource, /new FormData\(e\.currentTarget\)/)
})

test('auth forms use custom Russian validation instead of native browser messages', () => {
  assert.match(loginFormSource, /<form[^>]+noValidate/)
  assert.match(registerFormSource, /<form[^>]+noValidate/)
  assert.match(registerFormSource, /name="terms"/)
  assert.match(registerFormSource, /required/)
  assert.match(authModalSource, /termsAccepted/)
  assert.match(passwordInputSource, /name\?: string/)
  assert.match(passwordInputSource, /name=\{name\}/)
})
