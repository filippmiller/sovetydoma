// gen-images-openai.mjs — image pre-gen via OpenAI Images API (gpt-image-1).
// Picks content_matrix rows needing images, generates one JPEG each into
// public/images/<slug>.jpg, and updates the DB. No WSL / Grok dependency.
//
// Setup: put OPENAI_API_KEY=sk-... in .env.local (gitignored).
// Usage:
//   node scripts/matrix/gen-images-openai.mjs --limit 10
//   node scripts/matrix/gen-images-openai.mjs --limit 500 --concurrency 4 --quality medium
//   node scripts/matrix/gen-images-openai.mjs --verticals dacha,recepty --limit 50
//   node scripts/matrix/gen-images-openai.mjs --slug zapah-iz-obuvi          (single, for smoke test)
import fs from 'node:fs'
import path from 'node:path'
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const limit = parseInt(arg('--limit', '10'), 10)
const concurrency = Math.max(1, parseInt(arg('--concurrency', '3'), 10))
const model = arg('--model', 'gpt-image-1-mini')   // mini ≈ $0.005-0.008/img at low; gpt-image-1 = pricier
const quality = arg('--quality', 'low')            // low | medium | high — low is fine for preview thumbnails
const size = arg('--size', '1536x1024')            // landscape, close to article hero ratio
const onlySlug = arg('--slug', '')
const verticals = (arg('--verticals', '') || '').split(',').filter(Boolean)

const REPO = process.cwd()
const IMG_DIR = path.join(REPO, 'public', 'images')
fs.mkdirSync(IMG_DIR, { recursive: true })

const env = helpers.loadEnv()
const OPENAI_API_KEY = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env.local')
  process.exit(1)
}
const sb = helpers.getServiceClient()

// Keep generated images clean and on-brand; gpt-image-1 otherwise loves to add captions.
const STYLE_SUFFIX =
  ' Photorealistic, natural soft lighting, clean realistic composition, shallow depth of field. ' +
  'No text, no captions, no letters, no words, no watermark, no logo, no signage.'

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
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      quality,
      output_format: 'jpeg',
      output_compression: 82,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    // Backoff on rate limit / transient 5xx.
    if ((res.status === 429 || res.status >= 500) && attempt <= 4) {
      const wait = 2000 * attempt
      await new Promise((r) => setTimeout(r, wait))
      return generateOne(row, attempt + 1)
    }
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 300)}`)
  }
  const json = await res.json()
  const b64 = json?.data?.[0]?.b64_json
  if (!b64) throw new Error('no image data in response')
  const buf = Buffer.from(b64, 'base64')
  const filename = `${row.slug}.jpg`
  fs.writeFileSync(path.join(IMG_DIR, filename), buf)
  return { filename, bytes: buf.length }
}

async function persist(row, out) {
  await sb.from('content_matrix').update({
    image_status: 'generated',
    image_filename: out.filename,
    image_source: 'openai',
    image_model: model,
    image_generated_at: new Date().toISOString(),
    image_meta: { bytes: out.bytes, prompt: row.image_prompt || null, size, quality },
  }).eq('id', row.id)
  await sb.from('content_matrix_events').insert({
    matrix_id: row.id, axis: 'image', from_value: 'none', to_value: 'generated',
    agent: `openai-${model}`, notes: `${out.bytes} bytes`,
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
  console.log(`Picked ${rows.length} row(s) needing images. model=${model} size=${size} quality=${quality} concurrency=${concurrency}`)
  if (!rows.length) return
  const { ok, fail } = await runPool(rows)
  console.log(`Done. generated=${ok} failed=${fail}`)
  const { count } = await sb.from('content_matrix')
    .select('*', { count: 'exact', head: true })
    .eq('domain', DOMAIN).eq('image_status', 'generated').eq('image_source', 'openai')
  console.log(`Total OpenAI-generated images: ${count}`)
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
