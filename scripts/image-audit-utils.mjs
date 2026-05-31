import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const CATEGORY_QUERY = {
  kulinaria: 'russian food cooking dish',
  'dom-i-uborka': 'home cleaning tidy interior',
  'dacha-i-ogorod': 'vegetable garden gardening',
  layfkhaki: 'home organization practical life hack',
  ekonomiya: 'money saving budget home',
  rybalka: 'fishing river lake rod',
}

export const QUERY_MAP = {
  'idealnyy-borshch': 'borscht soup',
  'domashnie-bliny': 'russian pancakes blini',
  'bliny-na-moloke': 'russian pancakes blini',
  'domashnie-mayonez': 'homemade mayonnaise',
  'domashniy-mayonez-bystro': 'homemade mayonnaise jar',
  'domashnie-pelmeni-testo': 'dumpling dough pelmeni',
  'testo-dlya-pelmeney': 'dumpling dough',
  'testo-dlya-pitstsy': 'pizza dough',
  'solyanka-myasnaya': 'solyanka soup bowl',
  'solyanka-sbornaya-myasnaya': 'solyanka soup bowl',
  'nakip-v-chaynike': 'electric kettle limescale',
  'skovoroda-ot-zhira': 'dirty frying pan cleaning',
  'griby-sezony-sbor': 'forest mushrooms basket',
  'griby-zasolka': 'pickled mushrooms jar',
  'ogurcy-v-otkrytom-grunte': 'cucumber garden',
  'ogurcy-sorta-teplica': 'greenhouse cucumbers',
  'ogurcy-ot-tli': 'aphids cucumber plant',
  'tomaty-bolezni': 'tomato plant disease',
  'bolezni-ogurtsov': 'cucumber plant disease',
  'kleshchi-zashchita': 'forest path walk',
  'les-bezopasnost': 'forest hiking',
  'udobreniya-gryadki': 'garden soil fertilizer',
  'kompost-bystro': 'compost heap garden',
  'kompost-svoimi-rukami': 'compost bin garden',
  'podkormka-pomidorov': 'tomato plant care',
  'podkormka-pomidorov-teplitsa': 'tomato greenhouse',
  'podkormka-ogurtsov': 'cucumber plant care',
  'klubnika-na-podokonnike': 'strawberry plant windowsill',
  'klubnika-v-grunte': 'strawberry garden',
  'posadit-klubniku': 'planting strawberries',
  'zapakh-v-holodilnike': 'open refrigerator',
  'ubrat-zapah-iz-holodilnika': 'open refrigerator cleaning',
  'chistka-dukhovki': 'oven cleaning',
  'otmyt-duhovku-ot-zhira': 'oven cleaning grease',
  'krossovki-otmyt': 'white sneakers cleaning',
  'stirka-pukhovika': 'down jacket laundry',
  'stirka-puhovika': 'down jacket laundry',
  'ekonomiya-benzin': 'fuel pump car',
  'ekonomiya-benzina': 'fuel pump car',
  'menyu-na-nedelyu-3000': 'meal prep containers',
  'soda-10-sposobov': 'baking soda',
  'soda-v-bytu': 'baking soda home cleaning',
  'poryadok-za-15-minut': 'tidy clean room',
  'poryadok-v-shkafu': 'organized wardrobe',
  'hranenie-na-kuhne': 'organized kitchen storage',
  'hranenie-produktov': 'food storage containers',
  'hranenie-provodov': 'cable organization',
  'organizatsiya-kuhni': 'kitchen organization',
  'pochinit-molniyu': 'fix zipper',
  'razvyazat-uzel': 'untie knot rope',
  'zatochit-nozh': 'sharpening knife',
  'vysushit-obuv': 'drying wet shoes',
  'staticheskoe-elektrichestvo': 'static electricity clothes',
  'starye-dzhinsy': 'old jeans upcycle',
  'sel-telefon': 'wet smartphone rice',
  'zaryadka-telefona-layfhaki': 'charging phone cable',
  'otkryt-tuguyu-kryshku': 'opening jar lid',
  'ohladit-napitok-bystro': 'cold drink ice',
  'osy-pchely-osam': 'wasp window',
  'sornyaki-na-gazone': 'weeds lawn',
  'gryadki-iz-dosok': 'wooden raised garden beds',
  'sladkiy-perec': 'bell pepper garden',
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

export function buildImageAudit({ articles, images }) {
  const articleSlugs = new Set(articles.map((article) => article.slug))
  const imageSlugs = new Set(images.map((image) => image.slug))
  const hashGroups = new Map()

  for (const image of images) {
    if (!image.sha256) continue
    const group = hashGroups.get(image.sha256) || []
    group.push(image.slug)
    hashGroups.set(image.sha256, group)
  }

  const exactDuplicateGroups = [...hashGroups.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort())
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))

  return {
    articleCount: articles.length,
    imageCount: images.length,
    uniqueImageCount: hashGroups.size,
    exactDuplicateGroups,
    missingImages: [...articleSlugs].filter((slug) => !imageSlugs.has(slug)).sort(),
    orphanImages: [...imageSlugs].filter((slug) => !articleSlugs.has(slug)).sort(),
  }
}

export function buildUnsplashQueries(article) {
  const title = article.title || ''
  const tags = Array.isArray(article.tags) ? article.tags.filter(Boolean).join(' ') : ''
  const slugWords = (article.slug || '').replace(/-/g, ' ')
  const queries = [
    QUERY_MAP[article.slug],
    title && tags ? `${title} ${tags}` : title,
    tags,
    slugWords,
    CATEGORY_QUERY[article.category],
  ].filter(Boolean)

  return [...new Set(queries)]
}

export function chooseUniqueUnsplashResult(results, usedIds = new Set()) {
  for (const result of results || []) {
    const url = result?.urls?.regular
    if (!result?.id || !url) continue
    if (usedIds.has(result.id)) continue
    return {
      id: result.id,
      url,
      alt: result.alt_description || result.description || '',
      userName: result.user?.name || '',
      userUrl: result.user?.links?.html || '',
    }
  }
  return null
}

export function readArticleFiles(articlesDir) {
  return fs.readdirSync(articlesDir)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const text = fs.readFileSync(path.join(articlesDir, file), 'utf8')
      return {
        file,
        slug: readFrontmatterScalar(text, 'slug') || file.replace(/\.mdx$/, ''),
        title: readFrontmatterScalar(text, 'title') || '',
        category: readFrontmatterScalar(text, 'category') || '',
        image: readFrontmatterScalar(text, 'image') || '',
        tags: readFrontmatterTags(text),
      }
    })
}

export function readImageFiles(imagesDir) {
  if (!fs.existsSync(imagesDir)) return []
  return fs.readdirSync(imagesDir)
    .filter((file) => /\.(jpe?g)$/i.test(file))
    .map((file) => {
      const filePath = path.join(imagesDir, file)
      return {
        file,
        slug: file.replace(/\.(jpe?g)$/i, ''),
        sha256: sha256File(filePath),
        bytes: fs.statSync(filePath).size,
      }
    })
}

function readFrontmatterScalar(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm'))
  return match ? match[1].trim() : ''
}

function readFrontmatterTags(text) {
  const match = text.match(/^tags:\s*\[(.*)\]\s*$/m)
  if (!match) return []
  return match[1]
    .split(',')
    .map((tag) => tag.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}
