# VK ID auth setup handoff

Date: 2026-06-06

## Current status

VK ID login is not implemented in the current frontend code.

Checked signals:

- `src/components/auth/AuthModal.tsx` does not contain `signInWithOAuth`.
- No current `NEXT_PUBLIC_VK_AUTH_ENABLED`, `NEXT_PUBLIC_VK_OAUTH_PROVIDER`, or `custom:vk` wiring was found under `src/`.
- Existing VK-related frontend code is sharing/following UI, not authentication.

Do not enable VK auth in production until both Supabase and VK dashboard setup are complete and the frontend wiring is added/tested.

## Required implementation

Add a VK ID login button behind an explicit env flag:

```env
NEXT_PUBLIC_VK_AUTH_ENABLED=true
NEXT_PUBLIC_VK_OAUTH_PROVIDER=custom:vk
NEXT_PUBLIC_VK_OAUTH_SCOPES=
```

The button should call Supabase OAuth:

```ts
await supabase.auth.signInWithOAuth({
  provider: process.env.NEXT_PUBLIC_VK_OAUTH_PROVIDER || 'custom:vk',
  options: {
    redirectTo: getAuthRedirectTo(),
    scopes: process.env.NEXT_PUBLIC_VK_OAUTH_SCOPES || undefined,
  },
})
```

Keep VK client secrets and long-lived VK tokens out of `NEXT_PUBLIC_*`.

## Supabase dashboard

Configure a custom OAuth provider named `vk`, or set `NEXT_PUBLIC_VK_OAUTH_PROVIDER` to the actual provider id.

The VK application callback should be the Supabase callback URL:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

Allowed redirect URLs in Supabase URL Configuration should include:

```text
https://1001sovet.ru/
https://1001sovet.ru/moy-kabinet/
https://1001sovet.ru/izbrannoe/
```

For local QA, add the active local origin as needed, for example:

```text
http://localhost:3000/moy-kabinet/
```

## VK dashboard

Use the production domain:

```text
1001sovet.ru
```

Use the Supabase callback URL above as the trusted redirect URI. Do not use `https://1001sovet.ru/auth/vk/callback`; the static Next app does not currently implement that backend callback.

## Separate from autoposting

VK login and VK article autoposting are separate tracks.

Autoposting server-side work is covered by:

- `reports/vk-autoposting-setup-2026-06.md`
- `workers/subscriptions/src/social/vk.ts`
- `workers/subscriptions/src/index.ts`

Autoposting requires server-side secrets and must not be implemented with browser-exposed tokens.
