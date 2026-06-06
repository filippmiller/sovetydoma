/**
 * IndexNow URL submission script for Yandex and Bing.
 *
 * Usage:
 *   node scripts/submit-indexnow.mjs [--dry-run] [url1 url2 ...]
 *
 * Environment:
 *   INDEXNOW_KEY          — required secret key
 *   INDEXNOW_HOST         — defaults to "1001sovet.ru"
 *   INDEXNOW_KEY_LOCATION — optional custom key location URL
 *
 * If no URLs are provided via CLI, the script reads public/sitemap.xml,
 * extracts article URLs, and submits them. To avoid hammering the API,
 * it batches URLs in groups of 100 (IndexNow limit).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CATEGORIES } from '../src/lib/categories.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const KEY = process.env.INDEXNOW_KEY || ''
const HOST = process.env.INDEXNOW_HOST || '1001sovet.ru'
const KEY_LOCATION = process.env.INDEXNOW_KEY_LOCATION || ''
const DRY_RUN = process.argv.includes('--dry-run')

const ENDPOINT = 'https://yandex.com/indexnow'
const BATCH_SIZE = 100

function log(...args) {
  console.log('[indexnow]', ...args)
}

function errorExit(msg) {
  console.error('[indexnow] ERROR:', msg)
  process.exit(1)
}

async function submitBatch(urlList) {
  const payload = {
    host: HOST,
    key: KEY,
    ...(KEY_LOCATION ? { keyLocation: KEY_LOCATION } : {}),
    urlList,
  }

  if (DRY_RUN) {
    log('DRY-RUN would POST', urlList.length, 'URL(s)')
    for (const u of urlList) log('  -', u)
    return { status: 202, statusText: 'DRY-RUN' }
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  })

  const text = await res.text().catch(() => '')

  const statusLine = `${res.status} ${res.statusText}`
  if (res.status === 200 || res.status === 202) {
    log('OK', statusLine, `— submitted ${urlList.length} URL(s)`)
  } else if (res.status === 400) {
    log('BAD REQUEST (400) — invalid JSON or URL format:', text)
  } else if (res.status === 403) {
    log('FORBIDDEN (403) — key mismatch or host not allowed:', text)
  } else if (res.status === 422) {
    log('UNPROCESSABLE (422) — URLs do not belong to host or key invalid:', text)
  } else if (res.status === 429) {
    log('TOO MANY REQUESTS (429) — rate limited:', text)
  } else {
    log('UNEXPECTED', statusLine, ':', text)
  }

  return { status: res.status, statusText: res.statusText, body: text }
}

function parseSitemap() {
  const sitemapPath = path.join(__dirname, '../public/sitemap.xml')
  if (!fs.existsSync(sitemapPath)) {
    errorExit('sitemap.xml not found. Run build first.')
  }
  const xml = fs.readFileSync(sitemapPath, 'utf8')
  const categorySlugs = Object.values(CATEGORIES).map((c) => c.slug).join('|')
  const articlePattern = new RegExp(`^https://[^/]+/(${categorySlugs})/[a-z0-9-]+/$`)
  const matches = xml.matchAll(/<loc>([^<]+)<\/loc>/g)
  const urls = []
  for (const m of matches) {
    const url = m[1].trim()
    // Only submit article URLs (exclude static pages, paginated lists, archive)
    if (articlePattern.test(url)) {
      urls.push(url)
    }
  }
  return urls
}

function main() {
  if (!KEY) {
    errorExit('INDEXNOW_KEY is not set. Set it in environment before running.')
  }

  const cliUrls = process.argv
    .slice(2)
    .filter((arg) => arg !== '--dry-run')

  let urls = []
  if (cliUrls.length > 0) {
    urls = cliUrls
    log('Using', urls.length, 'URL(s) from CLI arguments')
  } else {
    urls = parseSitemap()
    log('Using', urls.length, 'article URL(s) from sitemap.xml')
  }

  if (urls.length === 0) {
    errorExit('No URLs to submit.')
  }

  // De-duplicate
  urls = [...new Set(urls)]

  // Validate URLs belong to host
  const hostPattern = new RegExp(`^https://(www\\.)?${HOST.replace(/\./g, '\\.')}/`)
  const invalid = urls.filter((u) => !hostPattern.test(u))
  if (invalid.length > 0) {
    errorExit(`URLs do not match host ${HOST}: ${invalid.join(', ')}`)
  }

  const batches = []
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    batches.push(urls.slice(i, i + BATCH_SIZE))
  }

  log('Submitting', urls.length, 'URL(s) in', batches.length, 'batch(es) to', ENDPOINT)

  ;(async () => {
    const results = []
    for (const batch of batches) {
      const r = await submitBatch(batch)
      results.push(r)
      // Be polite: small delay between batches
      if (!DRY_RUN && batches.length > 1) {
        await new Promise((res) => setTimeout(res, 500))
      }
    }

    const okCount = results.filter((r) => r.status === 200 || r.status === 202).length
    log('Done.', okCount, '/', batches.length, 'batches accepted.')
    if (okCount < batches.length) {
      process.exit(1)
    }
  })()
}

main()
