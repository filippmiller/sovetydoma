#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  CATEGORY_QUERY,
  QUERY_MAP,
  readArticleFiles,
  readImageFiles,
  sha256File,
} from './image-audit-utils.mjs'

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles')
const IMAGES_DIR = path.join(process.cwd(), 'public/images')
const SOURCES_FILE = path.join(IMAGES_DIR, '.sources.json')
const args = new Set(process.argv.slice(2))
const replaceGenerated = args.has('--replace-generated')
const replaceProcedural = args.has('--replace-procedural')
const maxFetches = Number(process.env.MAX_FETCHES || '9999')

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

function queriesFor(article) {
  return [...new Set([
    QUERY_MAP[article.slug],
    article.title,
    Array.isArray(article.tags) ? article.tags.join(' ') : '',
    article.slug.replace(/-/g, ' '),
    CATEGORY_QUERY[article.category],
  ].filter(Boolean))]
}

async function searchOpenverse(query) {
  const url = new URL('https://api.openverse.org/v1/images/')
  url.searchParams.set('q', query)
  url.searchParams.set('license_type', 'commercial,modification')
  url.searchParams.set('extension', 'jpg')
  url.searchParams.set('size', 'medium,large')
  url.searchParams.set('page_size', '20')
  const res = await fetch(url, { headers: { 'User-Agent': 'SovetyDomaBot/1.0' } })
  if (!res.ok) return []
  const data = await res.json()
  return data.results || []
}

async function downloadImage(url, dest) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'SovetyDomaBot/1.0' } })
  const type = res.headers.get('content-type') || ''
  if (!res.ok || !type.includes('image/')) throw new Error(`download ${res.status} ${type}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length < 4_000) throw new Error(`too small ${buffer.length}`)
  fs.writeFileSync(dest, buffer)
}

const sources = readSources()
const articles = readArticleFiles(ARTICLES_DIR)
const usedUrls = new Set(Object.values(sources).map((source) => source?.url || source?.thumbnail).filter(Boolean))
const usedHashes = new Set(readImageFiles(IMAGES_DIR).map((image) => image.sha256).filter(Boolean))
let fetched = 0
let skipped = 0
let failed = 0

for (const article of articles) {
  if (fetched >= maxFetches) break
  const dest = path.join(IMAGES_DIR, `${article.slug}.jpg`)
  const provider = sources[article.slug]?.provider
  const shouldReplace = (replaceGenerated && provider === 'generated-card')
    || (replaceProcedural && provider === 'procedural-photo-like')
  if (!shouldReplace && fs.existsSync(dest)) {
    skipped++
    continue
  }

  let done = false
  for (const query of queriesFor(article)) {
    const results = await searchOpenverse(query)
    for (const result of results) {
      const urls = [result.url, result.thumbnail].filter(Boolean)
      for (const url of urls) {
        if (usedUrls.has(url)) continue
        const temp = `${dest}.openverse.tmp`
        try {
          await downloadImage(url, temp)
        const hash = sha256File(temp)
        if (usedHashes.has(hash)) {
          fs.unlinkSync(temp)
          usedUrls.add(url)
          continue
        }
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        fs.renameSync(temp, dest)
        usedUrls.add(url)
        usedHashes.add(hash)
        sources[article.slug] = {
          provider: 'openverse',
          id: result.id,
          query,
          title: result.title,
          creator: result.creator,
          license: result.license,
          licenseVersion: result.license_version,
          foreignLandingUrl: result.foreign_landing_url,
          url,
          fetchedAt: new Date().toISOString(),
        }
        writeSources(sources)
        console.log(`ok ${article.slug} (${query})`)
        fetched++
        done = true
        break
        } catch {
          try { if (fs.existsSync(temp)) fs.unlinkSync(temp) } catch {}
        }
      }
      if (done) break
    }
    if (done || fetched >= maxFetches) break
    await sleep(300)
  }

  if (!done) {
    failed++
    console.log(`miss ${article.slug}`)
  }
  await sleep(250)
}

writeSources(sources)
console.log(`Done. fetched=${fetched} skipped=${skipped} failed=${failed}`)
