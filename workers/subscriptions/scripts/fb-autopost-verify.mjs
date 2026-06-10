// Verify the deployed code path: run processFbAutopost against PROD resources.
// Selects the latest unposted published article, posts it to FB with image,
// records the result in social_publications — exactly what the hourly cron does.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { processFbAutopost } from '../src/social/fb-autopost.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..', '..', '..')

// Load prod Supabase creds from repo .env.local
const envLocal = fs.readFileSync(path.join(repoRoot, '.env.local'), 'utf8')
const get = (k) => (envLocal.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()

const fb = JSON.parse(fs.readFileSync(path.join(here, '..', '.fb-test.local.json'), 'utf8'))

const env = {
  PUBLIC_SITE_URL: 'https://1001sovet.ru',
  SUPABASE_URL: get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: get('SUPABASE_SERVICE_ROLE_KEY'),
  FB_PAGE_ID: fb.FB_PAGE_ID,
  FB_PAGE_ACCESS_TOKEN: fb.FB_PAGE_ACCESS_TOKEN,
}

const result = await processFbAutopost(env)
console.log(JSON.stringify(result, null, 2))
