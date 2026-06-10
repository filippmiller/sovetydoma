// gen-images-fal.mjs — cheap image pre-gen via fal.ai (Flux Schnell, ~$0.003/img).
// Picks content_matrix rows needing images, generates one image each into
// public/images/<slug>.jpg, and updates the DB. Fast, no org verification.
//
// Setup: put FAL_KEY=... in .env.local (gitignored).
// Usage:
//   node scripts/matrix/gen-images-fal.mjs --slug zapah-iz-obuvi          (single smoke test)
//   node scripts/matrix/gen-images-fal.mjs --limit 30 --concurrency 4
//   node scripts/matrix/gen-images-fal.mjs --limit 1400 --concurrency 6
//   node scripts/matrix/gen-images-fal.mjs --verticals dacha,recepty --limit 50
//   node scripts/matrix/gen-images-fal.mjs --model fal-ai/flux/dev          (higher quality, pricier)
import fs from 'node:fs'
import path from 'node:path'
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const limit = parseInt(arg('--limit', '10'), 10)
const concurrency = Math.max(1, parseInt(arg('--concurrency', '4'), 10))
const model = arg('--model', 'fal-ai/flux/schnell')   // schnell = cheapest/fastest; flux/dev = nicer, pricier
const imageSize = arg('--size', 'landscape_4_3')        // landscape_4_3 (1024x768), landscape_16_9, square_hd...
const steps = parseInt(arg('--steps', '4'), 10)         // schnell is designed for ~4 steps
const onlySlug = arg('--slug', '')
const verticals = (arg('--verticals', '') || '').split(',').filter(Boolean)

const REPO = process.cwd()
const IMG_DIR = path.join(REPO, 'public', 'images')
fs.mkdirSync(IMG_DIR, { recursive: true })

const env = helpers.loadEnv()
const FAL_KEY = env.FAL_KEY || env.FAL_API_KEY || process.env.FAL_KEY
if (!FAL_KEY) {
  console.error('Missing FAL_KEY in .env.local')
  process.exit(1)
}
const sb = helpers.getServiceClient()

// Flux loves to render gibberish text; steer it away for clean photo previews.
const STYLE_SUFFIX =
  ' Photorealistic, natural soft lighting, clean realistic composition, shallow depth of field. ' +
  'No text, no captions, no letters, no words, no watermark, no logo.'

async function pick() {
  if (onlySlug) {
    const { data, error } = await sb.from('content_matrix')
      .select('id,slug,title,image_prompt,vertical')
      .eq('domain', DOMAIN).eq('slug', onlySlug).limit(1)
    if (error) throw new Error(error.message)
    return data || []
  }
  let q = sb.from('content_matrix')
    .select('id,slug,title,image_prompt,vertical')
    .eq('domain', DOMAIN).eq('disposition', 'active')
    .not('image_prompt', 'is', null).in('image_status', ['none', 'prompt_ready'])
    .order('priority', { ascending: false }).order('created_at', { ascending: true })
  if (verticals.length) q = q.in('vertical', verticals)
  const { data, error } = await q.limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}

async function generateOne(row, attempt = 1) {
  const prompt = `${(row.image_prompt || row.title)}.${STYLE_SUFFIX}`
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: imageSize,
      num_images: 1,
      num_inference_steps: steps,
      enable_safety_checker: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    if ((res.status === 429 || res.status >= 500) && attempt <= 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt))
      return generateOne(row, attempt + 1)
    }
    throw new Error(`fal ${res.status}: ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  const url = json?.images?.[0]?.url
  if (!url) throw new Error('no image url in response')
  // fal may return a data: URI or a hosted URL; handle both.
  let buf
  if (url.startsWith('data:')) {
    buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
  } else {
    const img = await fetch(url)
    if (!img.ok) throw new Error(`download ${img.status}`)
    buf = Buffer.from(await img.arrayBuffer())
  }
  const filename = `${row.slug}.jpg`
  fs.writeFileSync(path.join(IMG_DIR, filename), buf)
  return { filename, bytes: buf.length }
}

async function persist(row, out) {
  await sb.from('content_matrix').update({
    image_status: 'generated',
    image_filename: out.filename,
    image_source: 'fal',
    image_model: model,
    image_generated_at: new Date().toISOString(),
    image_meta: { bytes: out.bytes, prompt: row.image_prompt || null, image_size: imageSize, steps },
  }).eq('id', row.id)
  await sb.from('content_matrix_events').insert({
    matrix_id: row.id, axis: 'image', from_value: 'none', to_value: 'generated',
    agent: `fal-${model.split('/').pop()}`, notes: `${out.bytes} bytes`,
  })
}

async function runPool(rows) {
  let ok = 0, fail = 0, idx = 0
  async function worker(wid) {
    while (idx < rows.length) {
      const row = rows[idx++]
      try {
        const out = await generateOne(row)
        await persist(row, out)
        ok++
        console.log(`  [w${wid}] ${row.slug} OK (${(out.bytes / 1024).toFixed(0)} KB)`)
      } catch (e) {
        fail++
        console.log(`  [w${wid}] ${row.slug} FAILED: ${e.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)))
  return { ok, fail }
}

async function main() {
  const rows = await pick()
  console.log(`Picked ${rows.length} row(s) needing images. model=${model} size=${imageSize} steps=${steps} concurrency=${concurrency}`)
  if (!rows.length) return
  const { ok, fail } = await runPool(rows)
  console.log(`Done. generated=${ok} failed=${fail}`)
  const { count } = await sb.from('content_matrix')
    .select('*', { count: 'exact', head: true })
    .eq('domain', DOMAIN).eq('image_status', 'generated').eq('image_source', 'fal')
  console.log(`Total fal-generated images: ${count}`)
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
