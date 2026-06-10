// Local Facebook test post — proves image publishing works end-to-end against
// the real Graph API, without deploying the worker.
// Usage:
//   node --import tsx scripts/fb-test-post.mjs <article-slug> [--post]
// Reads creds from workers/subscriptions/.fb-test.local.json (gitignored).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishArticleToFacebook } from '../src/social/fb.ts'
import { findArticleRecord } from '../src/social/vk.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const creds = JSON.parse(fs.readFileSync(path.join(here, '..', '.fb-test.local.json'), 'utf8'))
const env = { ...creds }

const slug = process.argv[2]
const doPost = process.argv.includes('--post')
if (!slug) { console.error('need <article-slug>'); process.exit(1) }

const rec = findArticleRecord(slug)
if (!rec) { console.error(`slug not in publication index: ${slug}`); process.exit(1) }
console.log('Article:', rec.title)
console.log('Image URL:', `${env.PUBLIC_SITE_URL}${rec.image_path}`)

const result = await publishArticleToFacebook(env, slug, { dryRun: !doPost, requirePhoto: true, allowLinkFallback: false })
console.log(JSON.stringify(result, null, 2))
process.exit(result.ok ? 0 : 1)
