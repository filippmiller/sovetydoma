#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { QUERY_MAP, readArticleFiles } from './image-audit-utils.mjs'

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles')
const IMAGES_DIR = path.join(process.cwd(), 'public/images')
const SOURCES_FILE = path.join(IMAGES_DIR, '.sources.json')

const args = new Set(process.argv.slice(2))
const replaceGenerated = args.has('--replace-generated')
const replaceProcedural = args.has('--replace-procedural')
const maxImages = Number(process.env.MAX_IMAGES || '9999')
const concurrency = Number(process.env.CONCURRENCY || '6')
const onlySlugs = new Set((process.env.ONLY_SLUGS || '').split(',').map((slug) => slug.trim()).filter(Boolean))

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

function seedFor(slug) {
  let hash = 2166136261
  for (const char of slug) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function categoryScene(article) {
  switch (article.category) {
    case 'kulinaria':
      return 'real homemade food on a table in a modest kitchen, natural window light'
    case 'dom-i-uborka':
      return 'real home interior, practical household object, clean lived-in apartment, natural daylight'
    case 'dacha-i-ogorod':
      return 'real vegetable garden or dacha plot, soil, plants, hands working outdoors, natural daylight'
    case 'ekonomiya':
      return 'real household budget scene, groceries, bills or everyday shopping, natural daylight'
    case 'rybalka':
      return 'real fishing scene by a river or lake, fishing rod and outdoor gear, natural daylight'
    default:
      return 'real everyday household life hack scene, practical objects on a table, natural daylight'
  }
}

function promptFor(article) {
  const query = QUERY_MAP[article.slug] || article.title || article.slug.replace(/-/g, ' ')
  return [
    'photorealistic editorial photo',
    query,
    categoryScene(article),
    'realistic documentary style',
    'no text, no letters, no logo, no watermark, no illustration, no cartoon',
  ].join(', ')
}

async function downloadImage(article, dest) {
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(promptFor(article))}`)
  url.searchParams.set('width', '768')
  url.searchParams.set('height', '512')
  url.searchParams.set('seed', String(seedFor(article.slug)))
  url.searchParams.set('nologo', 'true')
  url.searchParams.set('model', 'flux')

  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(180_000) })
  const type = res.headers.get('content-type') || ''
  if (!res.ok || !type.includes('image/')) {
    throw new Error(`image generation failed: ${res.status} ${type}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length < 10_000) throw new Error(`image generation returned too small file: ${buffer.length}`)
  fs.writeFileSync(dest, buffer)
}

const sources = readSources()
const articles = readArticleFiles(ARTICLES_DIR)
const queue = []
let skipped = 0

for (const article of articles) {
  if (onlySlugs.size && !onlySlugs.has(article.slug)) continue
  const source = sources[article.slug]
  const shouldReplace = (replaceGenerated && source?.provider === 'generated-card')
    || (replaceProcedural && source?.provider === 'procedural-photo-like')
  const dest = path.join(IMAGES_DIR, `${article.slug}.jpg`)
  if (!shouldReplace && fs.existsSync(dest)) {
    skipped++
    continue
  }
  queue.push({ article, dest })
  if (queue.length >= maxImages) break
}

let cursor = 0
let generated = 0
let failed = 0

async function worker() {
  while (cursor < queue.length) {
    const item = queue[cursor++]
    const { article, dest } = item
    try {
      await downloadImage(article, dest)
      sources[article.slug] = {
        provider: 'pollinations',
        model: 'flux',
        prompt: promptFor(article),
        generatedAt: new Date().toISOString(),
      }
      generated++
      writeSources(sources)
      console.log(`ok ${article.slug}`)
      await sleep(150)
    } catch (error) {
      failed++
      console.log(`miss ${article.slug}: ${error.message}`)
      await sleep(500)
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()))

writeSources(sources)
console.log(`Done. generated=${generated} skipped=${skipped} failed=${failed}`)
