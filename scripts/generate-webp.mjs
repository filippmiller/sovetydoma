#!/usr/bin/env node
// Generate WebP siblings for every JPEG under public/images (and previews).
// Heroes (public/images/*.jpg) are ~1408x768 but display ~570px wide, so we
// cap width and re-encode as WebP — typically a 70-85% byte reduction. Previews
// are already small (240x240) and just get a WebP re-encode.
//
// Idempotent: skips when an up-to-date .webp already exists (newer than source).
// Outputs are gitignored and regenerated at build time (see package.json build).
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const HERO_DIR = path.join(ROOT, 'public/images')
const PREVIEW_DIR = path.join(ROOT, 'public/images/previews')

const HERO_MAX_WIDTH = 1200 // 2x the ~570px hero display width
const HERO_QUALITY = 78
const PREVIEW_QUALITY = 80

async function convert(file, { maxWidth, quality }) {
  const webp = file.replace(/\.jpe?g$/i, '.webp')
  try {
    const src = fs.statSync(file)
    if (fs.existsSync(webp) && fs.statSync(webp).mtimeMs >= src.mtimeMs) return 'skip'
  } catch { /* fall through to (re)generate */ }
  let pipeline = sharp(file).rotate()
  if (maxWidth) {
    const meta = await sharp(file).metadata()
    if (meta.width && meta.width > maxWidth) pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true })
  }
  await pipeline.webp({ quality }).toFile(webp)
  return 'made'
}

function listJpegs(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).map((f) => path.join(dir, f))
}

async function run() {
  const heroes = listJpegs(HERO_DIR).filter((f) => path.dirname(f) === HERO_DIR) // exclude previews subdir
  const previews = listJpegs(PREVIEW_DIR)
  let made = 0
  let skipped = 0
  let failed = 0

  const tasks = [
    ...heroes.map((f) => ({ f, opts: { maxWidth: HERO_MAX_WIDTH, quality: HERO_QUALITY } })),
    ...previews.map((f) => ({ f, opts: { maxWidth: null, quality: PREVIEW_QUALITY } })),
  ]

  // Bounded concurrency so we don't spawn 2000+ sharp pipelines at once.
  const CONCURRENCY = 8
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const { f, opts } = tasks[i++]
      try {
        const r = await convert(f, opts)
        if (r === 'made') made++
        else skipped++
      } catch (err) {
        failed++
        console.error(`webp fail: ${path.relative(ROOT, f)} — ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log(`WebP: ${made} generated, ${skipped} up-to-date, ${failed} failed (heroes=${heroes.length}, previews=${previews.length})`)
  if (failed > 0) process.exitCode = 1
}

run()
