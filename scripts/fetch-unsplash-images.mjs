import fs from 'fs'
import path from 'path'
import https from 'https'

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || ''
const ARTICLES_DIR = path.join(process.cwd(), 'src/content/articles')
const IMAGES_DIR = path.join(process.cwd(), 'public/images')

// Keyword map: article slug → Unsplash search query
const QUERY_MAP = {
  'idealnyy-borshch': 'borscht soup russian',
  'domashnie-bliny': 'russian pancakes blini',
  'domashnie-mayonez': 'homemade mayonnaise',
  'solyanka-myasnaya': 'russian meat soup',
  'nakip-v-chaynike': 'electric kettle kitchen',
  'skovoroda-ot-zhira': 'cast iron pan cleaning',
  'griby-sezony-sbor': 'forest mushrooms picking',
  'griby-zasolka': 'pickled mushrooms jar',
  'ogurcy-v-otkrytom-grunte': 'garden cucumbers growing',
  'ogurcy-sorta-teplica': 'greenhouse cucumbers',
  'tomaty-bolezni': 'tomato plants garden',
  'kleshchi-zashchita': 'forest walk safety',
  'les-bezopasnost': 'forest hiking russia',
  'udobreniya-gryadki': 'garden fertilizer soil',
  'osy-pchely-osam': 'wasp nest garden',
  'tli-nasekomye-sad': 'aphids garden plants',
  'parazity-rastenii': 'plant disease fungus',
  'kompost-bystro': 'compost garden organic',
  'podkormka-pomidorov': 'tomatoes fertilizing',
  'klubnika-na-podokonnike': 'strawberries windowsill',
  'kogda-sazhat-pomidory-2026': 'tomato seedlings spring',
  'ogurcy-ot-tli': 'cucumber plant aphids',
  'zapakh-v-holodilnike': 'refrigerator clean kitchen',
  'chistka-dukhovki': 'oven cleaning',
  'krossovki-otmyt': 'white sneakers clean',
  'stirka-pukhovika': 'washing down jacket',
  'ekonomiya-benzin': 'gas station car fuel',
  'ekonomiya-zhkh': 'utility bills home',
  'kashbek-karty-2026': 'credit cards cashback',
  'menyu-na-nedelyu-3000': 'weekly meal planning',
  'ekonomiya-na-produktakh': 'grocery shopping budget',
  'carapiny-na-mebeli': 'wood furniture scratch repair',
  'hranenie-produktov': 'food storage containers',
  'soda-10-sposobov': 'baking soda cleaning',
  'poryadok-za-15-minut': 'clean apartment room',
  'starye-dzhinsy': 'denim jeans diy craft',
}

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true })

async function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, res2 => res2.pipe(file))
      } else {
        res.pipe(file)
      }
      file.on('finish', () => { file.close(); resolve() })
    }).on('error', reject)
  })
}

async function fetchPhoto(query, slug) {
  if (!UNSPLASH_ACCESS_KEY) { console.log(`Skip ${slug} — no UNSPLASH_ACCESS_KEY`); return null }
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.urls?.regular || null
}

const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx'))
for (const file of files) {
  const slug = file.replace('.mdx', '')
  const imgPath = path.join(IMAGES_DIR, `${slug}.jpg`)
  if (fs.existsSync(imgPath)) { console.log(`✓ ${slug} — already exists`); continue }
  const query = QUERY_MAP[slug] || slug.replace(/-/g, ' ')
  const photoUrl = await fetchPhoto(query, slug)
  if (photoUrl) {
    await downloadImage(photoUrl, imgPath)
    console.log(`✓ Downloaded image for ${slug}`)
  } else {
    console.log(`- No image for ${slug}`)
  }
  await new Promise(r => setTimeout(r, 200)) // rate limit
}
console.log('Done fetching images.')
