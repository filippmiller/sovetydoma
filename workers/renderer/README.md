# sovetydoma-renderer

**NO-REDEPLOY publishing worker.** See [`docs/NO-REDEPLOY-PUBLISHING.md`](../../docs/NO-REDEPLOY-PUBLISHING.md) for the full epic.

Dynamically renders article pages for the static-export Next.js site **1001sovet.ru**.  
Caddy reverse-proxies requests for articles not present as static files to this worker, so new DB-only articles are served without rebuilding the site.

## Routes

| Route | Description |
|---|---|
| `GET /:category/:slug/` | Full SEO HTML rendered from `content_matrix` row + HTMLRewriter template transform |
| `GET /images/<filename>` | Stream article image from R2 bucket `sovetydoma-article-images` |
| `GET /sitemap-dynamic.xml` | Sitemap for articles published via `published_via=dynamic`; DB results are paginated so PostgREST's 1,000-row response cap cannot truncate it |

## Architecture

1. Caddy receives a request for e.g. `/avto/zamena-masla/` — the static file doesn't exist on disk.
2. Caddy `reverse_proxy` forwards the request to this worker.
3. Worker queries Supabase REST API for the article row.
4. Worker fetches the template page (`TEMPLATE_URL`, cached 10 min) as the HTML shell.
5. HTMLRewriter transforms the shell: title, meta tags, JSON-LD, breadcrumb, h1, hero image, date, category badge, tags, article body.
6. Response is cached in `caches.default` for 5 min and returned to Caddy / user.

## Setup

### 1. Install dependencies

```bash
cd workers/renderer
npm install
```

### 2. Set the secret

**Use `wrangler secret bulk` — NOT `wrangler secret put`.**
PowerShell pipes a BOM into `wrangler secret put` which corrupts the secret. See memory note `wrangler-secret-bom-gotcha.md`.

```bash
# Create a JSON file (in WSL/bash, not PowerShell):
echo '{"SUPABASE_SERVICE_ROLE_KEY":"<your-key>"}' > /tmp/renderer-secrets.json
wrangler secret bulk /tmp/renderer-secrets.json --name sovetydoma-renderer
rm /tmp/renderer-secrets.json
```

### 3. Create the R2 bucket (if not yet created)

```bash
wrangler r2 bucket create sovetydoma-article-images
```

### 4. Deploy

```bash
wrangler deploy
```

## Caddy integration

In your Caddyfile, after serving the static `output/` directory, add a fallback for missing article paths:

```caddyfile
www.1001sovet.ru {
  redir https://1001sovet.ru{uri} permanent
}

1001sovet.ru {
  root * /var/www/1001sovet/output

  # Serve static files first; fall back to renderer worker for missing paths
  @missing {
    not file
    path_regexp article ^/[a-z0-9-]+/[a-z0-9-]+/$
  }
  reverse_proxy @missing https://sovetydoma-renderer.<your-account>.workers.dev {
    header_up Host {upstream_hostport}
  }

  file_server
}
```

## Environment variables (wrangler.toml)

| Var | Default | Description |
|---|---|---|
| `SUPABASE_URL` | `https://api.1001sovet.ru` | Supabase REST base URL |
| `TEMPLATE_URL` | `https://1001sovet.ru/ekonomiya/ekonomiya-vody/` | Live article used as HTML shell |
| `SITE_URL` | `https://1001sovet.ru` | Canonical site URL |

## Secret

| Secret | Set via |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret bulk` (see above) |

## TypeScript check

```bash
cd workers/renderer
npm install
npx tsc --noEmit
```
