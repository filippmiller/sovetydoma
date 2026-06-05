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
  'borba-s-oduvanchikami': 'yellow dandelion lawn weed',
  'sornyaki-na-gazone': 'weeds lawn',
  'gryadki-iz-dosok': 'wooden raised garden beds',
  'sladkiy-perec': 'bell pepper garden',
  'byudzhet-na-dachu-na-mesyats': 'garden budget notebook receipts',
  'chistka-matrasa-doma': 'mattress bedroom',
  'domashniy-tvorog-iz-moloka': 'cottage cheese homemade milk',
  'ekonomiya-na-remonte-kvartiry': 'home renovation budget tools',
  'ekonomiya-na-shkolnyh-tovarah': 'school supplies notebook pencils',
  'gryadki-posle-sbora-urozhaya': 'raised beds garden',
  'hranenie-postelnogo-belya': 'linen closet',
  'hranenie-yablok-zimoy': 'apples storage wooden crate',
  'kabachkovye-oladi': 'zucchini fritters plate',
  'kak-bystro-nayti-poteryannuyu-veshch': 'lost keys',
  'kak-ne-pereplatit-za-dostavku': 'delivery package receipt',
  'kak-otmyt-plastikovye-podokonniki': 'white windowsill',
  'kak-pomyt-lyustru-bez-razvodov': 'glass chandelier cleaning',
  'kak-sushit-odezhdu-v-kvartire': 'drying clothes indoors rack',
  'kak-ubrat-nakleyku-bez-sledov': 'label removal',
  'kak-ubrat-pyatna-ot-chaya-i-kofe': 'coffee stain',
  'kak-ubrat-zapah-tabaka-v-kvartire': 'open window apartment ventilation',
  'kak-upakovat-podarok-bez-korobki': 'gift wrapping paper ribbon',
  'kapelnyy-poliv-svoimi-rukami': 'drip irrigation vegetable garden',
  'kuritsa-v-rukave': 'roasted chicken baking bag',
  'lenivye-golubtsy': 'cabbage rolls tomato sauce',
  'letniy-cheklist-pered-otpuskom': 'vacation checklist',
  'lovlya-foreli-na-platnike': 'trout fishing pond rod',
  'lovlya-leshcha-letom-na-fider': 'feeder fishing river bream',
  'mini-remont-bez-instrumentov': 'small home repair tools',
  'mulcha-dlya-ogoroda': 'mulch vegetable garden beds',
  'nochnaya-rybalka-s-berega': 'night fishing shore rod',
  'obrezka-maliny-posle-plodonosheniya': 'raspberry pruning',
  'ochistka-dushevoy-kabiny-ot-naleta': 'shower cleaning',
  'organizatsiya-dokumentov-doma': 'home document folders organization',
  'organizatsiya-hozyaystvennogo-shkafa': 'cleaning supplies closet',
  'pechenye-yabloki': 'baked apples cinnamon',
  'perlovka-bez-zamachivaniya': 'barley grains',
  'podkormka-klubniki-posle-urozhaya': 'strawberry plants garden care',
  'poplavok-dlya-techeniya': 'fishing float river current',
  'poryadok-v-prihozhey': 'entryway shoe rack',
  'prikormka-dlya-karasya-letom': 'carp fishing bait',
  'rassada-pertsa-doma': 'pepper seedlings',
  'ryba-v-duhovke': 'baked fish oven lemon',
  'salat-iz-svezhey-kapusty': 'fresh cabbage salad bowl',
  'semena-sbor-i-hranenie': 'garden seeds paper envelopes',
  'sezonnyy-spisok-pokupok': 'grocery shopping list seasonal vegetables',
  'sous-dlya-grechki': 'buckwheat sauce mushrooms plate',
  'sravnenie-tsen-pered-pokupkoy': 'price comparison shopping phone',
  'telefon-v-zharkuyu-pogodu': 'smartphone sun',
  'teplitsa-osenyu': 'greenhouse interior',
  'uhod-za-kozhanym-divanom': 'leather sofa',
  'zapasy-produktov-bez-pereplat': 'pantry food storage jars',
  'zashchita-rassady-ot-zamorozkov': 'seedlings frost protection cover',
  'apteka-dlya-dachi': 'first aid kit summer house',
  'bezopasnaya-zaryadka-telefona-nochyu': 'phone charger',
  'bezopasnost-doma-dlya-rebenka': 'child safety home',
  'borba-s-muravyami-v-teplitse': 'ants greenhouse garden',
  'chistka-filtra-konditsionera': 'air conditioner filter',
  'chto-delat-esli-pylesos-ploho-tyanet': 'vacuum cleaner filter',
  'hranenie-elochnyh-igrushek': 'christmas ornaments storage box',
  'hranenie-instrumentov-v-kvartire': 'home tools storage',
  'hranenie-kartofelya-v-kvartire': 'potatoes in basket',
  'hranenie-lekarstv-doma': 'medicine cabinet storage',
  'hranenie-v-malenkoy-kuhne': 'small kitchen storage',
  'kak-hranit-bytovuyu-tehniku': 'kitchen appliances shelf',
  'kak-hranit-shkolnye-tetradi': 'school notebooks storage',
  'kak-hranit-sumki-i-ryukzaki': 'bags backpacks storage',
  'kak-hranit-zimnyuyu-obuv': 'winter boots storage',
  'kak-ne-peregretsya-v-zharu-doma': 'hot apartment fan summer',
  'kak-obnovit-staryy-stul': 'old chair restoration',
  'kak-organizovat-utro-s-detmi': 'family morning routine kitchen',
  'kak-pokrasit-batareyu-bez-razvodov': 'painting radiator',
  'kak-povesit-polku-rovno': 'installing wall shelf level',
  'kak-prodlit-zhizn-stiralnoy-mashiny': 'washing machine maintenance',
  'kak-razobrat-balkon-bez-stressa': 'cluttered balcony cleaning',
  'kak-sazhat-lukovichnye-osenyu': 'planting bulbs autumn garden',
  'kak-sobrat-rebenka-v-lager': 'child camp packing suitcase',
  'kak-vybrat-arbuz-i-dynyu': 'watermelon melon market',
  'kak-vybrat-nastolnuyu-lampu': 'desk lamp home office',
  'kak-vybrat-shurupovert-dlya-doma': 'cordless screwdriver drill',
  'kak-vybrat-udlinitel-dlya-doma': 'power strip extension cord',
  'kak-zadelat-treshchinu-v-shtukaturke': 'wall crack repair plaster',
  'kompoty-na-zimu-bez-sterilizatsii': 'fruit compote jars',
  'melkiy-remont-sten-posle-dyubelov': 'wall holes repair plaster',
  'mnogoletenniki-dlya-nachinayushchih': 'perennial flowers garden',
  'organizatsiya-pod-rakovinoy': 'under sink storage',
  'osennyaya-podgotovka-gazona': 'autumn lawn care leaves',
  'poryadok-na-rabochem-stole': 'tidy home desk',
  'poryadok-v-detskih-veshchah': 'kids wardrobe',
  'poryadok-v-igrushkah': 'toys storage boxes',
  'remont-rozetki-kogda-vyzyvat-mastera': 'electrical outlet repair',
  'semeynyy-kalendar-na-holodilnike': 'fridge calendar',
  'shkolnyy-ugolok-doma': 'kids study desk home',
  'sistema-korobok-dlya-kladovki': 'pantry storage boxes',
  'skrip-dveri-i-petel': 'door hinge oil',
  'spisok-pokupok-dlya-semi': 'grocery shopping list family',
  'sushka-zeleni-doma': 'drying herbs kitchen',
  'uhod-za-elektrochaynikom': 'electric kettle cleaning',
  'uhod-za-holodilnikom': 'clean refrigerator shelves',
  'uhod-za-posudomoechnoy-mashinoy': 'dishwasher maintenance',
  'uhod-za-rozami-letom': 'roses summer garden care',
  'zamena-silikona-v-vannoy': 'bathroom silicone caulk',
  'zamrazhivanie-yagod-na-zimu': 'frozen berries freezer',
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

export function buildImageAudit({ articles, images, previews = [] }) {
  const articleSlugs = new Set(articles.map((article) => article.slug))
  const imageSlugs = new Set(images.map((image) => image.slug))
  const previewSlugs = new Set(previews.map((image) => image.slug))
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

  const expectedImage = (slug) => `/images/${slug}.jpg`
  const imageFrontmatterDrifts = articles
    .filter((a) => {
      const exp = expectedImage(a.slug)
      return (a.image || '').trim() !== exp
    })
    .map((a) => a.slug)
    .sort()

  return {
    articleCount: articles.length,
    imageCount: images.length,
    uniqueImageCount: hashGroups.size,
    exactDuplicateGroups,
    missingImages: [...articleSlugs].filter((slug) => !imageSlugs.has(slug)).sort(),
    missingPreviews: [...articleSlugs].filter((slug) => !previewSlugs.has(slug)).sort(),
    orphanImages: [...imageSlugs].filter((slug) => !articleSlugs.has(slug)).sort(),
    imageFrontmatterDrifts,
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
