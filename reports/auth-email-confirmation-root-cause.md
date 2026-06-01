# Auth Email Confirmation Root Cause

Date: 2026-06-01

## What Was Tested

- `auth.signUp` with `qa+user-...@example.test`: rejected as invalid email domain.
- `auth.signUp` with `alexmiller.idothings+qa-20260601073656@gmail.com`: accepted, created auth user/profile, returned no session.
- `signInWithPassword` for that QA user: failed with `Email not confirmed`.
- Gmail search for the QA confirmation email: no messages found.
- `auth.signUp` with `filippmiller@gmail.com`: failed with `email rate limit exceeded`; no email sent by that attempt.

## Root Cause

This is primarily Supabase Auth configuration, not frontend code.

- Email confirmation is enabled: signup creates a user but no session.
- Confirmation email delivery is not proven: no confirmation email was found.
- The project likely uses Supabase's default Auth email sender, which has a very low project-level email rate limit and is not suitable for production.
- The later `email rate limit exceeded` confirms the Auth email sender is currently throttled.

Official Supabase docs:

- Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Password/email auth: https://supabase.com/docs/guides/auth/passwords

## Code-Side Repair Applied

- `AuthModal` now explains `Email not confirmed` in user language.
- Added a resend-confirmation button using `supabase.auth.resend({ type: 'signup', email })`.
- Added explicit handling for `email rate limit exceeded`.
- Signup success state already tells the user to check email; it now offers resend and status feedback.

## Owner Action Required

Supabase Dashboard:

1. `Authentication -> Providers -> Email`: decide whether email confirmation should be enabled for this pre-launch site.
2. `Authentication -> SMTP Settings`: configure a real SMTP provider for production auth emails.
3. `Authentication -> URL Configuration`: set Site URL to `https://1001sovet.ru` and add local/staging redirect URLs as needed.
4. `Authentication -> Email Templates`: verify confirmation template and redirect URL.
5. Confirm or delete QA user `d6eb17b9-01d7-42df-950a-d74a66a2d592`.

## Current Status

Auth E2E cannot continue until a QA user can confirm email or email confirmation is disabled for testing.
