# Supabase Auth Dashboard & Email Deliverability Checklist

**For owner / person with dashboard access to project `plwkjdpuxjkmpkqiqzkk`**

This must be verified/fixed for reliable registration + password reset emails.

## 1. Authentication → URL Configuration
- **Site URL**: `https://1001sovet.ru`
- **Additional Redirect URLs** (add if missing):
  - `https://1001sovet.ru/**`
  - `https://1001sovet.ru/moy-kabinet/**`
  - `http://localhost:3000/**`
  - `http://127.0.0.1:3000/**`

For password reset, the redirect URL used in `resetPasswordForEmail` should be one of the above.

**Current code behavior (as of 2026-06)**: `getAuthRedirectTo()` points reset links to `https://1001sovet.ru/moy-kabinet/`. The client listens for `PASSWORD_RECOVERY` event and can show the reset form in the auth modal.

If recovery does not trigger properly on landing, the redirect target or additional allowed URLs may need adjustment in the dashboard.

## 2. Authentication → Providers → Email
- Confirm "Email" provider is enabled.
- **Email confirmation** — decide policy (currently enabled in code/config).
- Rate limits: consider raising temporarily for launch (`email_sent`, `sign_in_sign_ups`, `token_verifications`).

## 3. Authentication → SMTP Settings (Critical for delivery)
- Must be configured to use the real Mailcow mailbox (not Supabase default sender).
- Host: `mail.filippmiller.com`
- Port: 587 (STARTTLS)
- From address: something like `no-reply@1001sovet.ru` or `maryana.sidorova@1001sovet.ru` (as seen in successful 2026-06-04 test)
- Credentials: stored securely (not in this repo).

If this section is empty or points to default Supabase, delivery will be poor and rate-limited.

## 4. Authentication → Email Templates
- **Confirm signup**: use the custom template from `supabase/templates/confirmation.html` (or the one documented in `docs/supabase-auth-email-template.md`).
  - Subject must stay ASCII ("SovetyDoma: confirm your email") to avoid mojibake with custom SMTP.
- **Reset password** (new): Create / update the recovery template.
  - Clear Russian copy.
  - Prominent button with the recovery link (`{{ .ConfirmationURL }}` or equivalent for recovery).
  - Mention the site name and what the user is doing.

## 5. DNS / Deliverability (reg.ru + mail server)
- MX for 1001sovet.ru → `mail.filippmiller.com` (already correct)
- SPF: `v=spf1 mx ip4:89.167.42.128 ~all` (present)
- DMARC: Currently `p=none`. After monitoring, raise to `p=quarantine` or `p=reject`.
- DKIM: Verify that proper selectors are published for the sending domain (1001sovet.ru and/or filippmiller.com). This was not visible on common selectors during audit.

Test with tools like mail-tester.com or by sending to a real inbox + checking headers for SPF/DKIM/DMARC results.

## 6. Rate Limits & Monitoring (during initial rollout)
- Watch Supabase Auth logs for `email rate limit exceeded`.
- Have a way for support to manually trigger resends or reset for early users.

## 7. Recovery Redirect Handling (code side)
The reset link will redirect users (currently to `/moy-kabinet/` via our helper).
The client must be able to detect `PASSWORD_RECOVERY` event or a recovery session and show the "set new password" form.

See implementation in `src/components/auth/AuthModal.tsx` (Phase 1 work in progress).

---

**Owner action required**: Go through sections 1–5 in the Supabase dashboard and confirm/fix. Then reply here or update the checklist with "Done" + date.

If any of the above cannot be done from the code (they can't), this file serves as the exact handoff.

**Current implementation status (2026-06)**:
- Forgot request: done in code.
- Reset completion form + PASSWORD_RECOVERY detection: implemented (modal switches to reset view, updateUser called).
- Full end-to-end browser verification of clicking a real reset link requires:
  - Correct recovery redirect target + allowed URLs in dashboard.
  - Recovery email template configured.
  - Working SMTP so the reset email actually arrives.

**Blocker note**: Without owner confirmation that the Supabase Auth "Reset password" template and redirect URLs are correctly set (and that a test reset email can be sent), we cannot fully close the "completion flow works in production" item. Code is ready; email delivery side needs dashboard + DNS verification.

Last updated: 2026-06 during auth rewrite (sovetydoma-0h3).