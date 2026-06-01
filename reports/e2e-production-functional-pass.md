# Production Functional E2E Pass

Date: 2026-06-01
Branch: `audit/full-ui-ux-e2e-browser-pass`
Target: production Supabase via local app env
Approval: user explicitly approved controlled production QA mutation.

## QA Identity

- Requested pattern `qa+user-...@example.test` was rejected by Supabase as an invalid email domain.
- Retried with deliverable owner alias: `alexmiller.idothings+qa-20260601073656@gmail.com`.
- Password: redacted; use a fresh QA password for any future test account.
- Marker: `QA_E2E_20260601073656`
- Auth user id: `d6eb17b9-01d7-42df-950a-d74a66a2d592`

## What Was Created

- Supabase accepted `auth.signUp`.
- A `profiles` row was created by the auth/profile trigger:
  - `id`: `d6eb17b9-01d7-42df-950a-d74a66a2d592`
  - `display_name`: `QA User 20260601073656`
  - `role`: `user`

No comments, ratings, reactions, saved articles, photos, user article drafts, or feedback events were created.

## E2E Results

| Flow | Result | Evidence |
| --- | --- | --- |
| Registration | Partial fail | `auth.signUp` created user, but returned no session. |
| Login | Fail | `signInWithPassword` returns `Email not confirmed`. |
| Confirmation email | Fail | Gmail search found no confirmation email for the QA alias. |
| Authenticated saved article | Blocked | No confirmed session. |
| Authenticated rating | Blocked | No confirmed session. |
| Authenticated reaction | Blocked | No confirmed session. |
| Authenticated comment | Blocked | No confirmed session. |
| Photo upload | Blocked | Worker requires JWT from confirmed session. |
| User article submission | Blocked | No confirmed session. |
| Anonymous protected writes | Pass as security | RLS rejects anon writes to `profiles`, `ratings`, `reactions`, `comments`. |
| Anonymous view counter | Functional fail | `feedback_events` insert with `kind=view` is rejected by RLS, so `ViewTracker` cannot persist anonymous views. |
| Saved article schema | Functional bug fixed | `BookmarkButton` attempted to insert non-existent `article_title`; fixed to write only `user_id` and `article_slug`. |

## Current Table Counts After Attempt

| Table | Count |
| --- | ---: |
| `profiles` | 1 |
| `saved_articles` | 0 |
| `ratings` | 0 |
| `reactions` | 0 |
| `comments` | 0 |
| `photos` | 0 |
| `user_articles` | 0 |
| `questions` | 1 |
| `feedback_events` | 0 |
| `feedback_counters` | 0 |

## Critical Findings

1. Email confirmation is enabled or required, but the confirmation email did not arrive in Gmail. This blocks all authenticated production E2E and likely blocks real users from completing signup.
2. Anonymous view tracking is implemented in the frontend but rejected by RLS in production. Article/catalog view counters will stay at zero unless the policy or ingestion path is fixed.
3. `BookmarkButton` had a schema mismatch against `saved_articles`. This was fixed in code.

## Cleanup

The created auth/profile QA identity should be removed once no longer needed:

- Delete auth user `d6eb17b9-01d7-42df-950a-d74a66a2d592` from Supabase Auth.
- Delete `profiles.id = 'd6eb17b9-01d7-42df-950a-d74a66a2d592'`.

This requires Supabase dashboard access or a service-role key; the local repo does not contain a service-role seed path.
