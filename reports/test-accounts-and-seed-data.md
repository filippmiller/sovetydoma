# Test Accounts And Seed Data

Status: not created yet; ready for owner-approved production QA mutation or staging run.

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

## Proposed Production QA Data

- Email: `qa+user-20260601@example.test`
- Password: `TestPassword123!`
- Display name: `QA User 20260601`
- Article target: `borba-s-oduvanchikami`
- Seed interactions: saved article, 5-star rating, one heart reaction, one clearly marked QA comment, one user article draft if auth permits.
- Cleanup: delete rows by QA email/user id and `QA` marker in content.

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
