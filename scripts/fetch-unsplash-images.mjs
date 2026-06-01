#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import {
  buildImageAudit,
  buildUnsplashQueries,
  chooseUniqueUnsplashResult,
  readArticleFiles,
  readImageFiles,
  sha256File,
} from './image-audit-utils.mjs'

// Resumable, rate-limit-aware Unsplash image fetcher for SovetyDoma articles.
//
//   UNSPLASH_ACCESS_KEY=xxx node scripts/fetch-unsplash-images.mjs
//   UNSPLASH_ACCESS_KEY=xxx node scripts/fetch-unsplash-images.mjs --replace-duplicates
//   UNSPLASH_ACCESS_KEY=xxx node scripts/fetch-unsplash-images.mjs --replace-generated
//
// The fetcher now avoids the old per-category duplicate failure mode:
// - builds article-specific queries from title/tags/slug/category;
// - requests several Unsplash results, not only the first result;
// - rejects photo IDs already assigned in public/images/.sources.json;
// - rejects downloaded files whose hash already exists locally;
// - optionally replaces exact duplicate local images.

const KEY = process.env.UNSPLASH_ACCESS_KEY || ''
if (!KEY) {
  console.error('Missing UNSPLASH_ACCESS_KEY')
  process.exit(1)
}

const args = new Set(process.argv.slice(2))
const replaceDuplicates = args.has('--replace-duplicates')
const replaceGenerated = args.has('--replace-generated')
const maxFetches = Number(process.env.MAX_FETCHES || '9999')

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles')
const IMAGES_DIR = path.join(process.cwd(), 'public/images')
const SOURCES_FILE = path.join(IMAGES_DIR, '.sources.json')
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true })

function readSources() {
  try {
    return JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function writeSources(sources) {
  fs.writeFileSync(SOURCES_FILE, `${JSON.stringify(sources, null, 2)}\n`, 'utf8')
}

function duplicateSlugs(audit) {
  const slugs = new Set()
  for (const group of audit.exactDuplicateGroups) {
    for (const slug of group) slugs.add(slug)
  }
  return slugs
}

async function searchPhotos(query) {
  const url = new URL('https://api.unsplash.com/search/photos')
  url.searchParams.set('query', query)
  url.searchParams.set('orientation', 'landscape')
  url.searchParams.set('per_page', '30')
  url.searchParams.set('content_filter', 'high')
  url.searchParams.set('client_id', KEY)

  const res = await fetch(url)
  const remaining = res.headers.get('x-ratelimit-remaining')
  if (res.status === 403) return { results: [], remaining: 0, blocked: true }
  if (!res.ok) return { results: [], remaining }
  const data = await res.json()
  return { results: data.results || [], remaining }
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
}

async function fetchUniqueImage(article, dest, usedIds, usedHashes, sources) {
  for (const query of buildUnsplashQueries(article)) {
    const { results, remaining, blocked } = await searchPhotos(query)
    if (blocked) return { fetched: false, blocked: true, remaining }

    let candidates = results
    while (candidates.length) {
      const picked = chooseUniqueUnsplashResult(candidates, usedIds)
      if (!picked) break

      const temp = `${dest}.tmp`
      try {
        await download(picked.url, temp)
        const hash = sha256File(temp)
        if (usedHashes.has(hash)) {
          fs.unlinkSync(temp)
          usedIds.add(picked.id)
          candidates = candidates.filter((item) => item.id !== picked.id)
          continue
        }

        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        fs.renameSync(temp, dest)
        usedIds.add(picked.id)
        usedHashes.add(hash)
        sources[article.slug] = {
          provider: 'unsplash',
          id: picked.id,
          query,
          alt: picked.alt,
          userName: picked.userName,
          userUrl: picked.userUrl,
          fetchedAt: new Date().toISOString(),
        }
        return { fetched: true, remaining, query, id: picked.id }
      } catch {
        try { if (fs.existsSync(temp)) fs.unlinkSync(temp) } catch {}
        candidates = candidates.filter((item) => item.id !== picked.id)
      }
    }

    if (remaining !== null && Number(remaining) <= 0) return { fetched: false, blocked: true, remaining }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return { fetched: false, blocked: false, remaining: null }
}

const articles = readArticleFiles(ARTICLES_DIR)
let images = readImageFiles(IMAGES_DIR)
let audit = buildImageAudit({ articles, images })
const duplicateSet = duplicateSlugs(audit)
const sources = readSources()
const usedIds = new Set(Object.values(sources).map((source) => source?.id).filter(Boolean))
const usedHashes = new Set(images.map((image) => image.sha256).filter(Boolean))

let fetched = 0
let skipped = 0
let failed = 0
console.log(`${articles.length} articles total`)

for (const article of articles) {
  if (fetched >= maxFetches) break

  const dest = path.join(IMAGES_DIR, `${article.slug}.jpg`)
  const exists = fs.existsSync(dest)
  const shouldReplace = replaceDuplicates && duplicateSet.has(article.slug)
  const shouldReplaceGenerated = replaceGenerated && sources[article.slug]?.provider === 'generated-card'

  if (exists && !shouldReplace && !shouldReplaceGenerated) {
    skipped++
    continue
  }

  const result = await fetchUniqueImage(article, dest, usedIds, usedHashes, sources)
  if (result.blocked) {
    console.log(`\nPaused: rate limit exhausted. fetched=${fetched} skipped=${skipped} failed=${failed}`)
    break
  }

  if (result.fetched) {
    fetched++
    console.log(`ok ${article.slug} (${result.query}) [rl:${result.remaining}]`)
    writeSources(sources)
  } else {
    failed++
    console.log(`miss ${article.slug}`)
  }
}

images = readImageFiles(IMAGES_DIR)
audit = buildImageAudit({ articles, images })
writeSources(sources)
console.log(`\nDone. fetched=${fetched} skipped=${skipped} failed=${failed}. images=${audit.imageCount}/${audit.articleCount}. duplicateGroups=${audit.exactDuplicateGroups.length}. missing=${audit.missingImages.length}`)
