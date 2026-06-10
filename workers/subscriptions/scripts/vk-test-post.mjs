// Local VK test post — proves image publishing to the community wall works
// end-to-end against the real VK API, without deploying the worker.
// Usage:
//   npx tsx scripts/vk-test-post.mjs <article-slug> [--post]
// Reads creds from workers/subscriptions/.vk-test.local.json (gitignored).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishArticleToVk, getWallUploadServer, validateVkConfig } from '../src/social/vk.ts'
import { findArticleRecord } from '../src/social/vk.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const env = JSON.parse(fs.readFileSync(path.join(here, '..', '.vk-test.local.json'), 'utf8'))

const slug = process.argv[2]
const doPost = process.argv.includes('--post')
const probe = process.argv.includes('--probe')
if (!slug && !probe) { console.error('need <article-slug> or --probe'); process.exit(1) }

if (probe) {
  // Does this token work for wall photo upload at all?
  const config = validateVkConfig(env)
  try {
    const uploadUrl = await getWallUploadServer(env, config)
    console.log('getWallUploadServer OK:', uploadUrl ? 'got upload_url' : 'no url')
  } catch (e) {
    console.log('getWallUploadServer FAILED:', String(e))
  }
  process.exit(0)
}

const rec = findArticleRecord(slug)
if (!rec) { console.error(`slug not in publication index: ${slug}`); process.exit(1) }
console.log('Article:', rec.title)
console.log('Image URL:', `${env.PUBLIC_SITE_URL}${rec.image_path}`)

const link = process.argv.includes('--link')
const result = await publishArticleToVk(env, slug, { dryRun: !doPost, requirePhoto: !link, allowLinkFallback: link })
console.log(JSON.stringify(result, null, 2))
process.exit(result.ok ? 0 : 1)
