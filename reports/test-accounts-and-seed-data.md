# Test Accounts And Seed Data

Status: not created.

## Reason

The prompt asks for test users and seeded records, but the target currently available in this workspace is the production site and its live Supabase-backed flows. Creating users, comments, ratings, photo uploads, admin/moderator records, or email/contact traffic on production would mutate real data.

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
