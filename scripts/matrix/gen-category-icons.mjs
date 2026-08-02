// gen-category-icons.mjs — one AI-generated icon image per homepage category
// tile (src/lib/categories.mjs), via fal.ai (Flux Schnell — same provider as
// gen-images-fal.mjs, ~$0.003/image). Standalone: no content_matrix row
// picking, just a fixed prompt per category, written into
// public/images/categories/<slug>.jpg.
//
// Setup: FAL_KEY already present in .env.local (shared with gen-images-fal.mjs).
// Usage:
//   node scripts/matrix/gen-category-icons.mjs                 (all 12)
//   node scripts/matrix/gen-category-icons.mjs --slug kulinaria (single, smoke test)
import fs from 'node:fs'
import path from 'node:path'
import helpers from './lib.mjs'
import { IMAGE_STYLE_SUFFIX } from './lib.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const onlySlug = arg('--slug', '')
const model = arg('--model', 'fal-ai/flux/schnell')
const steps = parseInt(arg('--steps', '4'), 10)

const REPO = process.cwd()
const IMG_DIR = path.join(REPO, 'public', 'images', 'categories')
fs.mkdirSync(IMG_DIR, { recursive: true })

const env = helpers.loadEnv()
const FAL_KEY = env.FAL_KEY || env.FAL_API_KEY || process.env.FAL_KEY
if (!FAL_KEY) {
  console.error('Missing FAL_KEY in .env.local')
  process.exit(1)
}

// Simple icon-style scene per category — no people/hands (IMAGE_STYLE_SUFFIX
// already enforces that), clean still-life object arrangements that read at
// small sizes (these render as ~32-48px tiles on the homepage).
const ICON_PROMPT = {
  kulinaria: 'Simple flat icon illustration of a cozy kitchen still life: wooden cutting board, fresh vegetables, a cooking pot, warm rustic colors, soft rounded shapes, centered composition, plain light background',
  'dom-i-uborka': 'Simple flat icon illustration of a clean tidy home cleaning still life: spray bottle, folded cloth, soft brush, fresh bright colors, soft rounded shapes, centered composition, plain light background',
  'dacha-i-ogorod': 'Simple flat icon illustration of a sunny garden still life: watering can, small vegetable seedlings, garden trowel, green and earthy tones, soft rounded shapes, centered composition, plain light background',
  layfkhaki: 'Simple flat icon illustration of everyday household objects arranged neatly: lightbulb, tape roll, paperclip, warm friendly colors, soft rounded shapes, centered composition, plain light background',
  ekonomiya: 'Simple flat icon illustration of a piggy bank with coins and a small shopping basket, warm cozy colors, soft rounded shapes, centered composition, plain light background',
  rybalka: 'Simple flat icon illustration of a fishing rod, tackle box and a calm lake at sunrise, blue and warm orange tones, soft rounded shapes, centered composition, plain light background',
  'zdorovie-i-bezopasnost': 'Simple flat icon illustration of a home first-aid kit with a cross symbol and a small bottle, clean soft blue and green tones, soft rounded shapes, centered composition, plain light background',
  'semya-i-deti': 'Simple flat icon illustration of cozy stacked childrens toys and picture books on a shelf, warm pastel colors, soft rounded shapes, centered composition, plain light background',
  'krasota-i-uhod': 'Simple flat icon illustration of skincare bottles and a folded soft towel on a bathroom shelf, warm pastel tones, soft rounded shapes, centered composition, plain light background',
  'otdyh-i-puteshestviya': 'Simple flat icon illustration of a packed travel suitcase with a folded map and sunglasses, warm inviting colors, soft rounded shapes, centered composition, plain light background',
  'pokupki-i-tehnika': 'Simple flat icon illustration of modern home appliances and small gadgets neatly arranged, clean bright colors, soft rounded shapes, centered composition, plain light background',
  avto: 'Simple flat icon illustration of car maintenance tools and a shiny car headlight detail, clean garage still life, cool blue and metallic tones, soft rounded shapes, centered composition, plain light background',
}

const CATEGORIES = Object.keys(ICON_PROMPT)

async function generateOne(slug, attempt = 1) {
  const prompt = `${ICON_PROMPT[slug]}${IMAGE_STYLE_SUFFIX}`
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: { width: 512, height: 512 },
      num_images: 1,
      num_inference_steps: steps,
      enable_safety_checker: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    if ((res.status === 429 || res.status >= 500) && attempt <= 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt))
      return generateOne(slug, attempt + 1)
    }
    throw new Error(`fal ${res.status}: ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  const url = json?.images?.[0]?.url
  if (!url) throw new Error('no image url in response')
  let buf
  if (url.startsWith('data:')) {
    buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
  } else {
    const img = await fetch(url)
    if (!img.ok) throw new Error(`download ${img.status}`)
    buf = Buffer.from(await img.arrayBuffer())
  }
  const filename = `${slug}.jpg`
  fs.writeFileSync(path.join(IMG_DIR, filename), buf)
  return { filename, bytes: buf.length }
}

async function main() {
  const slugs = onlySlug ? [onlySlug] : CATEGORIES
  console.log(`Generating ${slugs.length} category icon(s) -> public/images/categories/`)
  let ok = 0, fail = 0
  for (const slug of slugs) {
    if (!ICON_PROMPT[slug]) {
      console.log(`  ${slug} SKIPPED (no prompt defined)`)
      continue
    }
    try {
      const out = await generateOne(slug)
      ok++
      console.log(`  ${slug} OK (${(out.bytes / 1024).toFixed(0)} KB)`)
    } catch (e) {
      fail++
      console.log(`  ${slug} FAILED: ${e.message}`)
    }
  }
  console.log(`Done. generated=${ok} failed=${fail}`)
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
