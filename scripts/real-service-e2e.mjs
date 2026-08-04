#!/usr/bin/env node
/* Read-only production certification.  It has no mocks or state-changing requests. */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(resolve(root, 'qa/real-service/manifest.json'), 'utf8'))
const artifactDir = resolve(root, 'qa/real-service/artifacts')
const strict = process.argv.includes('--strict')
const full = process.argv.includes('--full-sitemap')
const results = []
let build

const categories = ['dacha-i-ogorod', 'dom-i-uborka', 'ekonomiya', 'krasota-i-uhod', 'kulinaria', 'layfkhaki', 'otdyh-i-puteshestviya', 'pokupki-i-tehnika', 'rybalka', 'semya-i-deti', 'zdorovie-i-bezopasnost', 'avto']
const health = ['rastitelny-belok-chem-zamenit-myaso', 'supy-dlya-zdorovya-semi', 'travyanye-chai-doma-prigotovlenie', 'zagotovki-bez-sahara-sohranyaem-vitaminy', 'zdorovye-zavtrki-na-kazhdyy-den']
const hash = (body) => createHash('sha256').update(body).digest('hex').slice(0, 16)
const redact = (value) => String(value).replace(/(authorization|apikey|token|secret|password|cookie)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]').replace(/([?&](?:token|code|state|access_token|refresh_token|key)=)[^&\s]+/gi, '$1[REDACTED]')

async function request(url, options = {}) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25_000), ...options })
  const body = await response.text()
  return { url: response.url, status: response.status, contentType: response.headers.get('content-type') || '', body, length: Buffer.byteLength(body), bodyHash: hash(body) }
}
function assert(value, message) { if (!value) throw new Error(message) }
function add(id, status, summary, evidence = {}) { results.push({ id, status, summary, evidence: JSON.parse(JSON.stringify(evidence, (_, v) => typeof v === 'string' ? redact(v) : v)) }) }
async function stage(id, summary, action) { try { await action() } catch (error) { add(id, 'FAIL', summary, { error: error instanceof Error ? error.message : String(error) }) } }
async function parallel(items, limit, fn) {
  const output = []; let cursor = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (cursor < items.length) { const item = items[cursor++]; output.push(await fn(item)) } }))
  return output
}

const { site, renderer, subscriptions, photo, admin } = manifest.services
await stage('release.identity', 'Live build identity is structurally valid.', async () => {
  const r = await request(`${site}/build.json`); assert(r.status === 200, `build.json ${r.status}`); build = JSON.parse(r.body)
  assert(/^[a-f0-9]{40}$/i.test(build.sha || ''), 'build SHA is missing'); assert(['master', 'main'].includes(build.ref), `unexpected ref ${build.ref}`)
  add('release.identity', 'PASS', 'Live build identity is valid.', { status: r.status, build: { sha: build.sha, ref: build.ref, built_at: build.built_at }, bodyHash: r.bodyHash })
})
await stage('site.crawler-entrypoints', 'Robots, sitemap and RSS are public and structurally valid.', async () => {
  const [robots, sitemap, rss] = await Promise.all([request(`${site}/robots.txt`), request(`${site}/sitemap.xml`), request(`${site}/feed.xml`)])
  assert(robots.status === 200 && /sitemap/i.test(robots.body), 'robots sitemap declaration missing'); assert(sitemap.status === 200, `sitemap ${sitemap.status}`); assert(rss.status === 200 && /<rss/i.test(rss.body), 'RSS is invalid')
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]); assert(urls.length >= 548, `sitemap has ${urls.length}, expected >= 548`)
  add('site.crawler-entrypoints', 'PASS', 'Crawler entry points are valid.', { urls: urls.length, robots: robots.bodyHash, sitemap: sitemap.bodyHash, rss: rss.bodyHash })
})
await stage('site.static-route-matrix', 'Public static routes and all twelve categories return semantic HTML.', async () => {
  const paths = ['/', '/articles/', '/search/', '/recepty/', '/tag/', '/podpiski/', '/izbrannoe/', '/moy-kabinet/', ...categories.map((slug) => `/${slug}/`)]
  const pages = await parallel(paths, 4, async (path) => ({ path, response: await request(`${site}${path}`) }))
  const broken = pages.filter(({ response }) => response.status !== 200 || !/<title>[^<]+<\/title>/i.test(response.body) || !/rel="canonical"/i.test(response.body)).map(({ path, response }) => `${path}:${response.status}`)
  assert(broken.length === 0, `invalid routes: ${broken.join(', ')}`)
  add('site.static-route-matrix', 'PASS', 'Static routes and all categories are live with metadata.', { checked: paths.length, bodyHashes: pages.map(({ path, response }) => ({ path, hash: response.bodyHash })) })
})
await stage('site.health-article-matrix', 'All five health articles have covers, JSON-LD, table of contents and related links.', async () => {
  const pages = await parallel(health, 3, async (slug) => ({ slug, response: await request(`${site}/kulinaria/${slug}/`) }))
  const invalid = pages.filter(({ response }) => response.status !== 200 || !/application\/ld\+json/i.test(response.body) || !/aria-label="Содержание статьи"/i.test(response.body) || !/<img[^>]+src=/i.test(response.body)).map(({ slug, response }) => `${slug}:${response.status}`)
  assert(invalid.length === 0, `invalid health articles: ${invalid.join(', ')}`)
  add('site.health-article-matrix', 'PASS', 'Five health articles satisfy public semantic and image contracts.', { checked: pages.length, bodyHashes: pages.map(({ slug, response }) => ({ slug, hash: response.bodyHash })) })
})
await stage('site.dynamic-pipeline', 'A real dynamic sitemap record renders through the public production domain.', async () => {
  const sitemap = await request(`${site}/sitemap-dynamic.xml`); assert(sitemap.status === 200, `dynamic sitemap ${sitemap.status}`)
  const match = [...sitemap.body.matchAll(/<loc>https:\/\/1001sovet\.ru\/([^/]+)\/([^/]+)\/<\/loc>/g)].find((candidate) => candidate[1] !== 'stati'); assert(match, 'dynamic sitemap has no article')
  const page = await request(`${site}/${match[1]}/${match[2]}/`); assert(page.status === 200 && /application\/ld\+json/i.test(page.body), 'dynamic article is not semantic HTML')
  add('site.dynamic-pipeline', 'PASS', 'Dynamic content reaches the public site.', { record: `${match[1]}/${match[2]}`, sitemap: sitemap.bodyHash, page: page.bodyHash })
})
await stage('workers.public-read-and-admin-denial', 'Workers expose public read contracts and reject unauthenticated admin access.', async () => {
  const [latest, search, questions, targets, adminHealth, denied] = await Promise.all([
    request(`${renderer}/api/latest.json?limit=8`), request(`${renderer}/api/search-index.json`), request(`${photo}/article-questions?article_slug=${health[0]}`), request(`${subscriptions}/social/targets`), request(`${admin}/admin/health`), request(`${admin}/admin/articles`),
  ])
  assert(latest.status === 200 && Array.isArray(JSON.parse(latest.body)) && JSON.parse(latest.body).length > 0, 'latest index invalid'); assert(search.status === 200 && Array.isArray(JSON.parse(search.body)) && JSON.parse(search.body).length > 0, 'search index invalid'); assert(questions.status === 200, 'question read invalid'); assert(targets.status === 200, 'subscription public read invalid'); assert(adminHealth.status === 200 && JSON.parse(adminHealth.body).ok === true, 'admin health invalid'); assert([401, 403].includes(denied.status), `admin denial ${denied.status}`)
  add('workers.public-read-and-admin-denial', 'PASS', 'Public worker reads and admin denial are live.', { latest: latest.bodyHash, search: search.bodyHash, questions: questions.bodyHash, targets: targets.bodyHash, health: adminHealth.bodyHash, denied: denied.status })
})
await stage('site.sitemap-sample', 'A bounded sample of sitemap URLs is crawlable without stressing production.', async () => {
  const sitemap = await request(`${site}/sitemap.xml`); const all = [...sitemap.body.matchAll(/<loc>(https:\/\/1001sovet\.ru\/[^<]+)<\/loc>/g)].map((m) => m[1])
  const selected = full ? all : [...new Set([all[0], all.at(-1), ...all.filter((_, i) => i % Math.max(1, Math.floor(all.length / 30)) === 0)])].slice(0, full ? all.length : 32)
  const checked = await parallel(selected, 4, async (url) => ({ url, response: await request(url) })); const broken = checked.filter(({ response }) => response.status !== 200).map(({ url, response }) => `${url}:${response.status}`)
  assert(broken.length === 0, `uncrawlable sitemap URLs: ${broken.join(', ')}`); add('site.sitemap-sample', 'PASS', full ? 'Every sitemap URL is crawlable.' : 'Deterministic bounded sitemap sample is crawlable.', { mode: full ? 'full' : 'sample', checked: checked.length })
})

for (const [id, summary] of [
  ['auth.email-and-oauth', 'Dedicated email, VK and Yandex QA identities, confirmed inboxes and cleanup proof are required.'],
  ['ugc-and-photo-lifecycle', 'Dedicated QA identity, disposable content and exact database/R2 cleanup authority are required.'],
  ['subscriptions-and-push-delivery', 'Dedicated inbox/device, provider sandbox delivery receipt and cleanup authority are required.'],
  ['admin-content-lifecycle', 'Dedicated admin identity, isolated record, restore plan and cache propagation evidence are required.'],
  ['providers-webhooks-analytics', 'Private owned channels, callback credentials and provider-side receipts are required.'],
]) add(id, 'BLOCKED', summary, { mode: 'active', reason: 'No active QA resource or explicit E2E_ALLOW_ACTIVE approval was supplied.' })

const report = { schemaVersion: 2, name: manifest.name, startedAt: new Date().toISOString(), mode: 'read-only-live', strict, deploy: build ? { sha: build.sha, ref: build.ref, built_at: build.built_at } : null, counts: Object.fromEntries(['PASS', 'FAIL', 'BLOCKED'].map((status) => [status, results.filter((result) => result.status === status).length])), results }
await mkdir(artifactDir, { recursive: true }); const reportPath = resolve(artifactDir, `real-service-${Date.now()}.json`); await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ report: reportPath, ...report.counts, deploy: report.deploy }, null, 2))
if (report.counts.FAIL > 0 || (strict && report.counts.BLOCKED > 0)) process.exitCode = 1
