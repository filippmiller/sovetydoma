# СоветыДома

Production site: https://1001sovet.ru

This is a static Next.js site deployed only to the Timeweb Cloud VPS via GitHub
Actions. Do not set up Vercel deployment for this repository.

## Getting Started

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Gates

```bash
npm run lint
npm test
npm run audit:images
pnpm exec tsc --noEmit
npm run build
```

## Deployment

Pushes to `master` run GitHub Actions:

- `CI`
- `Deploy to Timeweb VPS`

The deploy workflow builds the static export, uploads it over SSH to the Timeweb
VPS, activates the release with an atomic symlink swap, and smoke-tests
`https://1001sovet.ru`.

## Operations

See [HANDOFF.md](./HANDOFF.md) for Timeweb VPS details, CI/CD, Mailcow,
Supabase Auth email, content generation, and rollback procedures.
