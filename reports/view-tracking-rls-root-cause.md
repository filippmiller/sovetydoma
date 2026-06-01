# View Tracking RLS Root Cause

Date: 2026-06-01

## What Was Tested

- Direct anonymous insert into `feedback_events`:
  - payload: `article_slug='borba-s-oduvanchikami'`, `kind='view'`, `comment=''`, `user_id=null`
  - result: `new row violates row-level security policy for table "feedback_events"`
- Read from `feedback_counters`:
  - result: public read works, rows count 0 for the tested slug.

## Root Cause

The frontend `ViewTracker` attempted to write anonymous view events directly through the public Supabase anon client. Production RLS rejects that write. The old frontend also dispatched `article-view-recorded` after awaiting the insert call without checking for an error, so the UI could optimistically increment even when the database rejected the event.

## Chosen Repair

Implemented the preferred static-site architecture:

- Add `/view` to the existing Cloudflare Worker.
- Worker validates slug, origin, and per-IP/per-article rate limits.
- Worker uses a secret `SUPABASE_SERVICE_ROLE_KEY` to insert only narrow `kind='view'` rows into `feedback_events`.
- Frontend `ViewTracker` now calls the worker and only marks localStorage / dispatches UI increment after HTTP success.

## Security Properties

- Does not weaken RLS.
- Does not allow anonymous arbitrary feedback writes.
- Does not expose the service-role key to the browser.
- Rate limiting is best-effort in Worker memory: 3/minute and 12/hour per IP/article.
- Frontend still limits one counted view per article per UTC day via localStorage.

## Required Deployment Config

Cloudflare Worker secret:

```powershell
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

The secret must be the Supabase service-role key for the project. Do not commit it.

Worker vars now include:

- `VIEW_ALLOWED_ORIGINS = "https://1001sovet.ru,http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:4177,http://localhost:4177"`

GitHub deploy should expose one of:

- `NEXT_PUBLIC_VIEW_WORKER_URL`
- `NEXT_PUBLIC_CONTACT_WORKER_URL`
- `NEXT_PUBLIC_PHOTO_WORKER_URL`

The existing deploy already passes contact/photo worker URLs; `ViewTracker` uses them as fallback.
