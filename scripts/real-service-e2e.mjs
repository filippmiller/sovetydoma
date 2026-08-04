#!/usr/bin/env node
/*
 * Fail-closed, real-service certification for 1001sovet.ru.
 *
 * This file intentionally has no mock transport, fixture loader, emulator, or
 * test-data fallback. It invokes the production endpoints named in the manifest.
 * A real service that cannot be reached or safely exercised is BLOCKED/FAIL, never
 * silently skipped. The default suite performs only GET/OPTIONS/expected-denial
 * requests. Active mutation tests are deliberately blocked until dedicated owned
 * QA identities, provider sandboxes, and a cleanup contract are supplied.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifestPath = resolve(root, 'qa/real-service/manifest.json')
const artifactDir = resolve(root, 'qa/real-service/artifacts')
const strict = process.argv.includes('--strict')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const startedAt = new Date().toISOString()
const results = []

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}

function redact(value) {
  return String(value)
    .replace(/(authorization|apikey|token|secret|password|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/([?&](?:token|code|state|access_token|refresh_token|key)=)[^&\s]+/gi, '$1[REDACTED]')
}

function add(id, status, summary, evidence = {}) {
  results.push({ id, status, summary, evidence: JSON.parse(JSON.stringify(evidence, (_, value) => typeof value === 'string' ? redact(value) : value)) })
}

async function request(url, options = {}) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25_000), ...options })
  const body = await response.text()
  return {
    url: response.url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    body,
    bodyHash: digest(body),
    length: Buffer.byteLength(body),
  }
}

async function real(id, summary, fn) {
  try {
    await fn()
  } catch (error) {
    add(id, 'FAIL', summary, { error: error instanceof Error ? error.message : String(error) })
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const { site, renderer, subscriptions, photo, admin } = manifest.services
let build
let latest
let dynamicRecord

await real('release.identity', 'Static production release identity is readable and structurally valid.', async () => {
  const response = await request(`${site}/build.json`)
  assert(response.status === 200, `expected 200, got ${response.status}`)
  build = JSON.parse(response.body)
  assert(/^[0-9a-f]{40}$/i.test(build.sha || ''), 'build.json lacks a Git SHA')
  assert(build.ref === 'master' || build.ref === 'main', `unexpected release ref ${build.ref}`)
  add('release.identity', 'PASS', 'Live static release identity is valid.', { status: response.status, bodyHash: response.bodyHash, build: { sha: build.sha, ref: build.ref, built_at: build.built_at } })
})

await real('release.activation-health', 'The production deployment activation endpoint is live.', async () => {
  const response = await request(`${site}/__deploy/health`)
  assert(response.status === 200, `deployment health expected 200, got ${response.status}`)
  const parsed = JSON.parse(response.body)
  assert(parsed.ok === true, 'deployment health did not report ok')
  add('release.activation-health', 'PASS', 'Production deployment activation endpoint reported healthy.', { status: response.status, bodyHash: response.bodyHash })
})

await real('site.home', 'Production homepage is delivered as real HTML.', async () => {
  const response = await request(`${site}/`)
  assert(response.status === 200, `expected 200, got ${response.status}`)
  assert(/<html[\s>]/i.test(response.body), 'response is not HTML')
  assert(/1001|Совет/i.test(response.body), 'site identity is absent from HTML')
  add('site.home', 'PASS', 'Production homepage returned real HTML.', { status: response.status, contentType: response.contentType, length: response.length, bodyHash: response.bodyHash })
})

await real('site.robots-and-static-sitemap', 'Crawler entry points are readable from production.', async () => {
  const [robots, sitemap] = await Promise.all([request(`${site}/robots.txt`), request(`${site}/sitemap.xml`)])
  assert(robots.status === 200, `robots.txt expected 200, got ${robots.status}`)
  assert(/sitemap/i.test(robots.body), 'robots.txt does not advertise a sitemap')
  assert(sitemap.status === 200, `sitemap.xml expected 200, got ${sitemap.status}`)
  const locations = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  assert(locations.length > 0, 'static sitemap has no URLs')
  add('site.robots-and-static-sitemap', 'PASS', 'Production robots and static sitemap are structurally valid.', { robots: { status: robots.status, bodyHash: robots.bodyHash }, sitemap: { status: sitemap.status, locations: locations.length, bodyHash: sitemap.bodyHash } })
})

await real('renderer.latest-index', 'Renderer exposes real latest-content inventory.', async () => {
  const response = await request(`${renderer}/api/latest.json?limit=8`)
  assert(response.status === 200, `expected 200, got ${response.status}`)
  latest = JSON.parse(response.body)
  assert(Array.isArray(latest) && latest.length > 0, 'latest index is empty')
  for (const row of latest) assert(typeof row.slug === 'string' && typeof row.category === 'string' && typeof row.title === 'string', 'latest index has an incomplete row')
  add('renderer.latest-index', 'PASS', 'Renderer returned a non-empty real latest-content index.', { status: response.status, rows: latest.length, sample: { slug: latest[0].slug, category: latest[0].category, publishedAt: latest[0].publishedAt }, bodyHash: response.bodyHash })
})

await real('renderer.search-and-category-index', 'Renderer search and category indexes expose real records.', async () => {
  const [search, category] = await Promise.all([request(`${renderer}/api/search-index.json`), request(`${renderer}/api/category-latest.json?category=${encodeURIComponent(latest?.[0]?.category || 'kulinaria')}`)])
  assert(search.status === 200, `search index expected 200, got ${search.status}`)
  assert(category.status === 200, `category index expected 200, got ${category.status}`)
  const searchRows = JSON.parse(search.body)
  const categoryRows = JSON.parse(category.body)
  assert(Array.isArray(searchRows) && searchRows.length > 0, 'search index is empty')
  assert(Array.isArray(categoryRows) && categoryRows.length > 0, 'category index is empty')
  assert(categoryRows.every((row) => typeof row.slug === 'string' && typeof row.category === 'string'), 'category index has an incomplete row')
  assert(searchRows.some((searchRow) => categoryRows.some((categoryRow) => categoryRow.slug === searchRow.slug)), 'search and category indexes have no shared real record')
  add('renderer.search-and-category-index', 'PASS', 'Renderer search and category feeds returned linked real records.', { search: { rows: searchRows.length, bodyHash: search.bodyHash }, category: { rows: categoryRows.length, bodyHash: category.bodyHash } })
})

await real('pipeline.dynamic-publication', 'A real dynamic record is discoverable in sitemap and delivered through the production domain.', async () => {
  const sitemap = await request(`${site}/sitemap-dynamic.xml`)
  assert(sitemap.status === 200, `dynamic sitemap expected 200, got ${sitemap.status}`)
  const locations = [...sitemap.body.matchAll(/<loc>https:\/\/1001sovet\.ru\/([^/]+)\/([^/]+)\/<\/loc>/g)].filter((match) => match[1] !== 'stati')
  assert(locations.length > 0, 'dynamic sitemap has no article URL')
  const [, category, slug] = locations[0]
  dynamicRecord = { category, slug }
  const page = await request(`${site}/${encodeURIComponent(category)}/${encodeURIComponent(slug)}/`)
  assert(page.status === 200, `public dynamic article expected 200, got ${page.status}`)
  assert(page.body.includes(slug), 'public article does not match its dynamic sitemap URL')
  add('pipeline.dynamic-publication', 'PASS', 'A dynamic-sitemap record is rendered through the production domain.', { record: dynamicRecord, sitemap: { status: sitemap.status, bodyHash: sitemap.bodyHash }, page: { status: page.status, length: page.length, bodyHash: page.bodyHash } })
})

await real('renderer.dynamic-page-runtime', 'Dynamic HTML preserves required semantic runtime output.', async () => {
  assert(dynamicRecord, 'dynamic sitemap record unavailable')
  const page = await request(`${site}/${encodeURIComponent(dynamicRecord.category)}/${encodeURIComponent(dynamicRecord.slug)}/`)
  assert(page.status === 200, `dynamic page expected 200, got ${page.status}`)
  assert(/application\/ld\+json/i.test(page.body), 'dynamic page has no JSON-LD')
  assert(new RegExp(`<link[^>]+rel=["']canonical["'][^>]+${dynamicRecord.slug}|<link[^>]+${dynamicRecord.slug}[^>]+rel=["']canonical["']`, 'i').test(page.body), 'dynamic page has no canonical for its sitemap URL')
  add('renderer.dynamic-page-runtime', 'PASS', 'Dynamic page contains live JSON-LD and a canonical URL.', { status: page.status, bodyHash: page.bodyHash })
})

await real('worker.photo-public-read', 'Photo/UGC worker accepts a real non-mutating public read.', async () => {
  const response = await request(`${photo}/article-questions?article_slug=${encodeURIComponent(latest?.[0]?.slug || 'unknown')}`)
  assert(response.status === 200, `questions endpoint expected 200, got ${response.status}`)
  const parsed = JSON.parse(response.body)
  assert(Array.isArray(parsed) || Array.isArray(parsed.questions), 'questions endpoint returned an invalid shape')
  add('worker.photo-public-read', 'PASS', 'Photo/UGC worker returned a real public read response.', { status: response.status, bodyHash: response.bodyHash, length: response.length })
})

await real('worker.photo-published-count', 'Photo worker returns a real published-article count.', async () => {
  const response = await request(`${photo}/article-count`)
  assert(response.status === 200, `article-count expected 200, got ${response.status}`)
  const parsed = JSON.parse(response.body)
  assert(Number.isInteger(parsed.published) && parsed.published >= 0, 'article-count response has no non-negative published count')
  add('worker.photo-published-count', 'PASS', 'Photo worker returned a real published-article count.', { status: response.status, published: parsed.published, bodyHash: response.bodyHash })
})

await real('worker.subscriptions-public-read', 'Subscriptions worker returns real public social-target state.', async () => {
  const response = await request(`${subscriptions}/social/targets`)
  assert(response.status === 200, `social targets expected 200, got ${response.status}`)
  const parsed = JSON.parse(response.body)
  assert(parsed.ok === true && Array.isArray(parsed.targets), 'social targets response shape is invalid')
  add('worker.subscriptions-public-read', 'PASS', 'Subscriptions worker returned a real public state response.', { status: response.status, targets: parsed.targets.length, bodyHash: response.bodyHash })
})

await real('worker.admin-health', 'Admin worker reports its real dependency capability state.', async () => {
  const response = await request(`${admin}/admin/health`)
  assert(response.status === 200, `health expected 200, got ${response.status}`)
  const parsed = JSON.parse(response.body)
  assert(parsed.ok === true && parsed.media && ['r2', 'fal', 'purge', 'renderer_binding'].every((key) => parsed.media[key] === true), 'admin worker has an unhealthy declared dependency')
  add('worker.admin-health', 'PASS', 'Admin worker reported all declared media dependencies healthy.', { status: response.status, media: parsed.media, bodyHash: response.bodyHash })
})

await real('worker.admin-access-control', 'Admin API rejects an unauthenticated real request.', async () => {
  const response = await request(`${admin}/admin/articles`)
  assert([401, 403].includes(response.status), `unauthenticated admin endpoint expected 401/403, got ${response.status}`)
  add('worker.admin-access-control', 'PASS', 'Admin API rejected an unauthenticated live request.', { status: response.status, bodyHash: response.bodyHash })
})

const activeStages = [
  ['auth.email-session', 'Dedicated QA email/password account, confirmed inbox, and cleanup authorization are required.'],
  ['auth.vk-oauth', 'Dedicated owned VK account plus interactive callback/session/logout proof are required.'],
  ['auth.yandex-oauth', 'Dedicated owned Yandex account plus interactive callback/session/logout proof are required.'],
  ['ugc-and-photo.lifecycle', 'Dedicated QA identity, owned disposable content, upload object, moderation role, and exact cleanup authorization are required.'],
  ['subscriptions.delivery-lifecycle', 'Dedicated inbox plus provider delivery/callback access and unsubscribe cleanup are required.'],
  ['push.permission-and-delivery', 'Fresh browser permission, dedicated endpoint, sandbox fan-out permission, and device receipt evidence are required.'],
  ['admin.content-lifecycle', 'Dedicated admin QA identity, isolated content record, R2 cleanup, and restoration authorization are required.'],
  ['social-and-webhook-roundtrip', 'Private owned Telegram/MAX/WhatsApp/VK/Facebook/Resend QA channels and callback credentials are required.'],
  ['cron-digest-autopost', 'A scheduled-run trigger, private owned social targets, correlation IDs, duplicate guard, and cleanup authorization are required.'],
  ['analytics.provider-receipt', 'Independent unblocked network and read access to GA4/Yandex provider dashboards are required.'],
]
for (const [id, summary] of activeStages) add(id, 'BLOCKED', summary, { mode: 'active', reason: 'This run has no declared dedicated QA resource and does not perform production writes by default.' })

const report = {
  schemaVersion: 1,
  name: manifest.name,
  startedAt,
  finishedAt: new Date().toISOString(),
  mode: 'read-only-live',
  strict,
  deploy: build ? { sha: build.sha, ref: build.ref, built_at: build.built_at } : null,
  counts: Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map((status) => [status, results.filter((result) => result.status === status).length])),
  results,
}
await mkdir(artifactDir, { recursive: true })
const stamp = startedAt.replace(/[:.]/g, '-')
const reportPath = resolve(artifactDir, `real-service-${stamp}.json`)
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ report: reportPath, ...report.counts, deploy: report.deploy }, null, 2))
if (strict && (report.counts.FAIL > 0 || report.counts.BLOCKED > 0)) process.exitCode = 1
else if (report.counts.FAIL > 0) process.exitCode = 1
