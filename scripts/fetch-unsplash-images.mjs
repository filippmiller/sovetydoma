import fs from 'fs'
import path from 'path'

// Resumable, rate-limit-aware Unsplash image fetcher for SovetyDoma articles.
//
//   UNSPLASH_ACCESS_KEY=xxx node scripts/fetch-unsplash-images.mjs
//
// - Reads every src/content/articles/*.mdx, fetches a relevant landscape photo,
//   saves it to public/images/<slug>.jpg (served as /images/<slug>.jpg).
// - SKIPS slugs that already have a file → safe to re-run across hourly batches.
// - Demo Unsplash apps allow 50 requests/hour. The script watches the
//   X-Ratelimit-Remaining header and STOPS cleanly when the budget is gone,
//   so you just re-run it next hour to continue where it left off.
// - Query priority: explicit QUERY_MAP entry → category English query → a
//   transliteration-ish fallback from the slug.

const KEY = process.env.UNSPLASH_ACCESS_KEY || ''
if (!KEY) { console.error('Missing UNSPLASH_ACCESS_KEY'); process.exit(1) }

const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles')
const IMAGES_DIR = path.join(process.cwd(), 'public/images')
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true })

// Good English search queries by category (reliable Unsplash results).
const CATEGORY_QUERY = {
  kulinaria: 'russian food cooking dish',
  'dom-i-uborka': 'home cleaning tidy interior',
  'dacha-i-ogorod': 'vegetable garden gardening',
  layfkhaki: 'home life hack organization',
  ekonomiya: 'money saving budget home',
  rybalka: 'fishing river lake rod',
}

// Hand-tuned overrides for specific slugs (best relevance).
const QUERY_MAP = {
  'idealnyy-borshch': 'borscht soup', 'domashnie-bliny': 'russian pancakes blini',
  'domashnie-mayonez': 'homemade mayonnaise', 'solyanka-myasnaya': 'meat soup bowl',
  'nakip-v-chaynike': 'electric kettle', 'skovoroda-ot-zhira': 'cast iron pan',
  'griby-sezony-sbor': 'forest mushrooms', 'griby-zasolka': 'pickled mushrooms jar',
  'ogurcy-v-otkrytom-grunte': 'cucumber garden', 'tomaty-bolezni': 'tomato plants',
  'kleshchi-zashchita': 'forest path walk', 'les-bezopasnost': 'forest hiking',
  'udobreniya-gryadki': 'garden soil fertilizer', 'kompost-bystro': 'compost heap garden',
  'podkormka-pomidorov': 'tomato plant care', 'klubnika-na-podokonnike': 'strawberry plant',
  'zapakh-v-holodilnike': 'open refrigerator', 'chistka-dukhovki': 'oven cleaning',
  'krossovki-otmyt': 'white sneakers', 'stirka-pukhovika': 'down jacket laundry',
  'ekonomiya-benzin': 'fuel pump car', 'menyu-na-nedelyu-3000': 'meal prep containers',
  'soda-10-sposobov': 'baking soda', 'poryadok-za-15-minut': 'tidy clean room',
}

function readCategory(file) {
  try {
    const txt = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8')
    const m = txt.match(/^category:\s*["']?([a-z-]+)["']?/m)
    return m ? m[1] : null
  } catch { return null }
}

async function fetchPhotoUrl(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1&content_filter=high&client_id=${KEY}`
  const res = await fetch(url)
  const remaining = res.headers.get('x-ratelimit-remaining')
  if (res.status === 403) return { url: null, remaining: 0, blocked: true }
  if (!res.ok) return { url: null, remaining }
  const data = await res.json()
  return { url: data.results?.[0]?.urls?.regular || null, remaining }
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
}

const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx'))
let fetched = 0, skipped = 0, failed = 0
console.log(`${files.length} articles total`)

for (const file of files) {
  const slug = file.replace('.mdx', '')
  const dest = path.join(IMAGES_DIR, `${slug}.jpg`)
  if (fs.existsSync(dest)) { skipped++; continue }

  const cat = readCategory(file)
  const query = QUERY_MAP[slug] || CATEGORY_QUERY[cat] || slug.replace(/-/g, ' ')

  const { url, remaining, blocked } = await fetchPhotoUrl(query)
  if (blocked) {
    console.log(`\n⏸  Rate limit hit. Fetched ${fetched} this run. Re-run next hour to continue.`)
    break
  }
  if (url) {
    try { await download(url, dest); fetched++; console.log(`✓ ${slug}  (${query})  [rl:${remaining}]`) }
    catch (e) { failed++; console.log(`✗ ${slug} download failed: ${e.message}`) }
  } else {
    failed++; console.log(`- ${slug}: no result for "${query}"`)
  }
  if (remaining !== null && Number(remaining) <= 0) {
    console.log(`\n⏸  Rate budget exhausted. Re-run next hour to continue.`); break
  }
  await new Promise(r => setTimeout(r, 250))
}

const have = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.jpg')).length
console.log(`\nDone. fetched=${fetched} skipped=${skipped} failed=${failed}. Total images on disk: ${have}/${files.length}`)
