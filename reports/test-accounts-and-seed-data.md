# Test Accounts And Seed Data

Status: partially created after explicit approval.

## Reason

The prompt asks for test users and seeded records. The target currently available in this workspace is the production site and its live Supabase-backed flows. The database appears effectively empty for core UGC tables, so a controlled QA mutation is low-impact, but it is still a production write and should be explicitly approved or run against staging.

## Current Public Table Counts

Checked with the public anon Supabase key:

| Table | Count |
| --- | ---: |
| `profiles` | 0 |
| `saved_articles` | 0 |
| `ratings` | 0 |
| `reactions` | 0 |
| `comments` | 0 |
| `photos` | 0 |
| `user_articles` | 0 |
| `questions` | 1 |
| `feedback_events` | 0 |
| `feedback_counters` | 0 |

## Created Production QA Identity

- Email: `alexmiller.idothings+qa-20260601073656@gmail.com`
- Password: redacted; use a fresh QA password for any future test account.
- User id: `d6eb17b9-01d7-42df-950a-d74a66a2d592`
- Profile row: created automatically with `display_name = QA User 20260601073656`
- Status: cannot sign in because Supabase returns `Email not confirmed`.
- Gmail search result: no confirmation email found.

The original requested `qa+user-...@example.test` address could not be used because Supabase rejected the `.test` domain as invalid.

## Proposed Production QA Data

- Email: `alexmiller.idothings+qa-[timestamp]@gmail.com`
- Password: fresh QA password, not committed.
- Display name: `QA User 20260601`
- Article target: `borba-s-oduvanchikami`
- Seed interactions: saved article, 5-star rating, one heart reaction, one clearly marked QA comment, one user article draft if auth/email confirmation permits.
- Cleanup: delete rows by QA email/user id and `QA` marker in content.

## Cleanup Required

Remove auth/profile QA identity:

- `auth.users.id = d6eb17b9-01d7-42df-950a-d74a66a2d592`
- `profiles.id = d6eb17b9-01d7-42df-950a-d74a66a2d592`

## Needed For Full E2E

- Staging site URL.
- Staging Supabase URL and anon key.
- Approved test email inboxes or disposable addresses.
- Clear roles to seed: anonymous, normal user, moderator, admin.
- Permission to create and later delete test rows in `profiles`, `saved_articles`, `ratings`, `reactions`, `comments`, `photos`, `user_articles`, `questions`, and `feedback_events`.

## Safe Coverage Completed

- Anonymous public browsing.
- Search query route behavior.
- Static image rendering.
- Contact form render state without submission.
- Admin/login route render state without credential attempts.
