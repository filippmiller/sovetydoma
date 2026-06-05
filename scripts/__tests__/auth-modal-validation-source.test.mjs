import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const authModalSource = readFileSync('src/components/auth/AuthModal.tsx', 'utf8')
const passwordInputSource = readFileSync('src/components/auth/PasswordInput.tsx', 'utf8')

function between(source, start, end) {
  const startIndex = source.indexOf(start)
  assert.notEqual(startIndex, -1, `Missing marker: ${start}`)
  const endIndex = source.indexOf(end, startIndex)
  assert.notEqual(endIndex, -1, `Missing marker: ${end}`)
  return source.slice(startIndex, endIndex)
}

test('login form submits the same fields that the user edits', () => {
  const loginBlock = between(authModalSource, '{/* Login form */}', '{/* Forgot password request form')

  assert.match(loginBlock, /name="email"/)
  assert.match(loginBlock, /value=\{email\}/)
  assert.doesNotMatch(loginBlock, /value=\{registerEmail\}/)
  assert.match(loginBlock, /name="password"/)
  assert.match(authModalSource, /new FormData\(e\.currentTarget\)/)
})

test('auth forms use custom Russian validation instead of native browser messages', () => {
  const loginBlock = between(authModalSource, '{/* Login form */}', '{/* Forgot password request form')
  const registerBlock = between(authModalSource, '{/* Register form */}', '{/* Social proof footer */}')

  assert.match(loginBlock, /<form[^>]+noValidate/)
  assert.match(registerBlock, /<form[^>]+noValidate/)
  assert.match(registerBlock, /name="terms"/)
  assert.match(registerBlock, /required/)
  assert.match(authModalSource, /termsAccepted/)
  assert.match(passwordInputSource, /name\?: string/)
  assert.match(passwordInputSource, /name=\{name\}/)
})
