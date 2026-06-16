// gen-images.mjs — image pre-gen via Grok CLI (xAI Imagine via the imagine skill).
// Picks rows needing images, generates one image each, saves to public/images/<slug>.jpg, updates DB.
// Usage: node scripts/matrix/gen-images.mjs --limit 10 [--verticals dacha,ogorod]
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import helpers from './lib.mjs'

const DOMAIN = '1001sovet.ru'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const limit = parseInt(arg('--limit', '10'), 10)
const verticals = (arg('--verticals', '') || '').split(',').filter(Boolean)
const REPO = 'C:/DEV/sovetydoma'
const WSL_REPO = '/mnt/c/DEV/sovetydoma'
const PROMPT_DIR = path.join(REPO, '.matrix-ideas', 'imgprompts')
fs.mkdirSync(PROMPT_DIR, { recursive: true })
fs.mkdirSync(path.join(REPO, 'public', 'images'), { recursive: true })

const sb = helpers.getServiceClient()

async function pick() {
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

function grokGenerate(row) {
  const imgPath = `public/images/${row.slug}.jpg`
  const full = `${REPO}/${imgPath}`
  const prompt = `Use your image generation capability (the "imagine" skill / image_gen tool, xAI Imagine) to generate ONE photorealistic image from this description:

"${(row.image_prompt || row.title).replace(/"/g, "'")}"

Then save the generated image to this exact path using a shell command:
  cp "<path that image_gen returned>" ${WSL_REPO}/${imgPath}

Generate the image directly — do NOT search the web for how to do it. Do NOT run list_dir on the images folder (it is huge). After saving, run: ls -la ${WSL_REPO}/${imgPath} and then print: SAVED ${row.slug}.jpg`
  const pf = path.join(PROMPT_DIR, `${row.slug}.txt`)
  fs.writeFileSync(pf, prompt, 'utf8')
  const wslPf = `${WSL_REPO}/.matrix-ideas/imgprompts/${row.slug}.txt`
  const cmd = `export PATH="$HOME/.grok/bin:$PATH"; cd ${WSL_REPO}; grok --prompt-file "${wslPf}" --cwd ${WSL_REPO} --permission-mode bypassPermissions --no-subagents --max-turns 10 --output-format plain`
  spawnSync('wsl.exe', ['-d', 'Ubuntu-24.04', '-u', 'root', '--', 'bash', '-lc', cmd], { timeout: 300000, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 })
  return fs.existsSync(full) ? full : null
}

async function main() {
  const rows = await pick()
  console.log(`Picked ${rows.length} rows needing images${verticals.length ? ' (' + verticals.join(',') + ')' : ''}.`)
  let ok = 0, fail = 0
  for (const row of rows) {
    process.stdout.write(`  [${row.slug}] generating... `)
    let saved = null
    try { saved = grokGenerate(row) } catch (e) { console.log('error: ' + e.message); }
    if (saved) {
      const stat = fs.statSync(saved)
      await sb.from('content_matrix').update({
        image_status: 'generated',
        image_filename: `${row.slug}.jpg`,
        image_source: 'grok-imagine',
        image_model: 'xai-imagine',
        image_generated_at: new Date().toISOString(),
        image_meta: { bytes: stat.size, prompt: row.image_prompt || null },
      }).eq('id', row.id)
      await sb.from('content_matrix_events').insert({ matrix_id: row.id, axis: 'image', from_value: 'none', to_value: 'generated', agent: 'grok-imagine', notes: `${stat.size} bytes` })
      ok++; console.log(`OK (${(stat.size / 1024).toFixed(0)} KB)`)
    } else { fail++; console.log('FAILED (no file)') }
  }
  console.log(`Done. generated=${ok} failed=${fail}`)
  const { count } = await sb.from('content_matrix').select('*', { count: 'exact', head: true }).eq('domain', DOMAIN).eq('image_status', 'generated').neq('image_source', 'legacy-seed')
  console.log(`Total newly-generated images: ${count}`)
}
main().catch((e) => { console.error('fatal:', e); process.exit(1) })
