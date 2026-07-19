/**
 * Prompt hygiene for article hero generation (ported from scripts/matrix/lib.mjs).
 * Keep in sync with buildImagePrompt / sanitizeImagePrompt.
 */

export const IMAGE_STYLE_SUFFIX =
  '. Photorealistic photograph, sharp focus, natural daylight, clean composition. ' +
  'No people, no hands, no fingers, no faces, no body parts, no figurines, no text.'

const CATEGORY_SCENE: Record<string, string> = {
  kulinaria: 'Russian home kitchen food photography',
  'dom-i-uborka': 'clean tidy Russian home interior',
  'dacha-i-ogorod': 'Russian dacha garden and vegetable beds',
  rybalka: 'fishing tackle by a Russian lake or river',
  ekonomiya: 'household money-saving still life on a table',
  layfkhaki: 'everyday household objects on a clean surface',
  'zdorovie-i-bezopasnost': 'home safety and first-aid items still life',
  'semya-i-deti': 'cozy family home setting, no people',
  'krasota-i-uhod': 'skincare and cosmetics flat lay',
  'otdyh-i-puteshestviya': 'travel gear and outdoor scenery',
  'pokupki-i-tehnika': 'home appliances and gadgets on a desk',
  avto: 'car maintenance tools and parts',
}

/** Quick presets admins can toggle in the media UI. */
export const PROMPT_PRESETS: Record<string, string> = {
  no_people: 'No people, no hands, no fingers, no faces, no body parts.',
  no_text: 'No text, no logos, no watermarks, no captions.',
  photorealism: 'Photorealistic photograph, natural daylight, sharp focus.',
  product: 'Product photography, clean surface, soft studio light, subject centered.',
  safe: 'No dangerous actions, no weapons, no injury, no blood.',
  landscape_4_3: 'Landscape 4:3 composition, subject fills the frame without extreme crop.',
}

export function sanitizeImagePrompt(raw: unknown): string {
  let p = String(raw || '').trim()
  p = p.replace(
    /[,.]?\s*(photorealistic|photo-realistic|natural day ?light|natural daylight|no text|no logos?|no watermark|16:9|9:16)\b[\s\S]*$/i,
    '',
  )
  p = p.replace(
    /^\s*(close-?up of\s+)?(a\s+|an\s+)?(pair of\s+)?hands?\s+\w+?(ing)?\s+(a\s+|an\s+|the\s+)?/i,
    (_m, closeup) => (closeup ? 'Close-up of ' : ''),
  )
  p = p.replace(
    /^\s*(a\s+|an\s+)?(young\s+|elderly\s+|middle-aged\s+|senior\s+)?(person|people|woman|man|girl|boy|child|kid|gardener|cook|chef|angler|fisherman|housewife|worker|homeowner)\s+\w+?(ing)?\s+(a\s+|an\s+|the\s+)?/i,
    '',
  )
  p = p.replace(/,?\s+with\s+(?:a\s+)?(?:gloved\s+)?hands?\s+\w+ing\b[^,.]*/gi, '')
  p = p.replace(/,\s+(?:a\s+)?(?:gloved\s+)?hands?\s+\w+ing\b[^,.]*/gi, '')
  p = p.replace(/^\s*(pressing|placing|holding|a|the)?\s*fingers?\s+(into|onto|on|in|against|to)\s+/i, '')
  p = p.replace(/\b(with|using)\s+(her|his|their|a|the)?\s*(bare\s+)?(hands?|fingers?)\b/gi, '')
  p = p.replace(/\bby a (person|woman|man|gardener|cook)\b/gi, '')
  p = p.replace(/\b(human )?(hands?|fingers?)\b/gi, '')
  p = p.replace(/,\s*,/g, ',').replace(/\bwith\s*,/gi, '').replace(/,\s*$/g, '')
  p = p.replace(/\s{2,}/g, ' ').replace(/^[\s,.;-]+/, '').trim()
  if (!p) return ''
  p = p.charAt(0).toUpperCase() + p.slice(1)
  if (!/[.!?]$/.test(p)) p += '.'
  return p
}

export function buildImagePrompt(
  rawPrompt: unknown,
  title: unknown,
  category: unknown,
  extraPresets: string[] = [],
): string {
  const base =
    sanitizeImagePrompt(rawPrompt) ||
    sanitizeImagePrompt(title) ||
    String(title || '').trim()
  const cat = String(category || '')
  const scene = CATEGORY_SCENE[cat]
  const thin = base.split(/\s+/).filter(Boolean).length <= 5
  const lead = scene && thin ? `${scene}: ` : ''
  const presetBits = extraPresets
    .map((k) => PROMPT_PRESETS[k])
    .filter(Boolean)
    .join(' ')
  const suffix = presetBits ? ` ${presetBits}` : ''
  return `${lead}${base}${IMAGE_STYLE_SUFFIX}${suffix}`
}

export function defaultNegativePrompt(presets: string[] = []): string {
  const parts = [
    'people, hands, fingers, faces, body parts, text, logos, watermark, cartoon, low quality',
  ]
  if (presets.includes('safe')) parts.push('weapons, blood, injury, dangerous action')
  return parts.join(', ')
}

/** R2 / URL-safe versioned key: slug-v{n}-{rand}.jpg */
export function makeStorageKey(slug: string, version: number, salt: string): string {
  const safeSlug = String(slug || 'article')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article'
  const safeSalt = String(salt || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 12) || 'x'
  return `${safeSlug}-v${Math.max(1, version)}-${safeSalt}.jpg`
}

export function publicImageUrl(siteUrl: string, storageKey: string): string {
  const base = (siteUrl || 'https://1001sovet.ru').replace(/\/+$/, '')
  return `${base}/images/${storageKey}`
}
