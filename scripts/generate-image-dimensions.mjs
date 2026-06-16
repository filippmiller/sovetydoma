#!/usr/bin/env node
// Build-time manifest: scan public/images/*.jpg (top-level hero images only,
// not previews) and write src/lib/image-dimensions.json mapping
// "<slug>.jpg" -> { w: number, h: number }.
//
// Idempotent — safe to re-run; always overwrites the manifest.
// Uses `sharp` (already a devDependency) for reliable JPEG dimension reads.
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const HERO_DIR = path.join(ROOT, 'public', 'images')
const OUT_FILE = path.join(ROOT, 'src', 'lib', 'image-dimensions.json')

async function run() {
  if (!fs.existsSync(HERO_DIR)) {
    console.error(`image-dimensions: hero dir not found: ${HERO_DIR}`)
    process.exit(1)
  }

  const files = fs
    .readdirSync(HERO_DIR)
    .filter((f) => /\.jpe?g$/i.test(f) && !fs.statSync(path.join(HERO_DIR, f)).isDirectory())

  /** @type {Record<string, { w: number; h: number }>} */
  const manifest = {}

  let ok = 0
  let failed = 0

  await Promise.all(
    files.map(async (filename) => {
      try {
        const meta = await sharp(path.join(HERO_DIR, filename)).metadata()
        if (meta.width && meta.height) {
          manifest[filename] = { w: meta.width, h: meta.height }
          ok++
        } else {
          console.warn(`image-dimensions: no dims for ${filename}`)
          failed++
        }
      } catch (err) {
        console.warn(`image-dimensions: failed ${filename} — ${err.message}`)
        failed++
      }
    }),
  )

  // Sort keys for stable diffs
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
  fs.writeFileSync(OUT_FILE, JSON.stringify(sorted, null, 2) + '\n', 'utf8')

  console.log(
    `image-dimensions: ${ok} entries written to src/lib/image-dimensions.json` +
      (failed > 0 ? ` (${failed} failed)` : ''),
  )
  if (failed > 0) process.exitCode = 1
}

run()
