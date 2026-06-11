import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Resolve .env.local from the repo root (cwd when run via npm/`matrix:*` scripts).
// Portable across Windows node and WSL node — no hardcoded /mnt/c path.
const ENV_PATH = path.resolve(process.cwd(), '.env.local')

export function loadEnv() {
  let text
  try {
    text = fs.readFileSync(ENV_PATH, 'utf8')
  } catch {
    return {}
  }
  const env = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = rawLine.indexOf('=')
    if (eqIdx === -1) continue
    const key = rawLine.slice(0, eqIdx).trim()
    const value = rawLine.slice(eqIdx + 1).trim()
    if (key) env[key] = value
  }
  return env
}

export function getServiceClient() {
  const env = loadEnv()
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) {
    throw new Error('Missing SUPABASE_URL (checked in loadEnv from .env.local)')
  }
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (checked in loadEnv from .env.local)')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export function wordCount(md) {
  let text = String(md || '')
  // strip fenced code blocks (```...```)
  text = text.replace(/```[\s\S]*?```/g, ' ')
  // strip inline code
  text = text.replace(/`[^`]*`/g, ' ')
  // roughly strip markdown punctuation and special chars
  text = text.replace(/[#*_~[\]()<>!|"`'“”‘’—–…:;,.?]/g, ' ')
  // strip urls
  text = text.replace(/https?:\/\/\S+/g, ' ')
  // normalize ws
  text = text.replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(' ').filter(Boolean).length
}

export function hasMojibake(s) {
  const str = String(s || '')
  if (/[\uFFFDÐÑÃÂ]/.test(str) || str.includes('â€') || str.includes('Â ')) return true
  return false
}

// Flux (esp. schnell at low steps) mangles hands and faces into "goblins".
// Most home-tips images read better as clean object/scene shots anyway, so we
// (1) reframe person/hands subjects toward the object/result, and (2) append a
// strong no-people/no-hands/anti-deformity style. The reframe matters: removing
// the human SUBJECT avoids the contradiction of a positive "hands" + "no hands".
export const IMAGE_STYLE_SUFFIX =
  ' Professional photorealistic stock photo, object-focused still life or real scene, ' +
  'natural soft daylight, sharp focus, realistic textures and accurate proportions, ' +
  'clean uncluttered composition, shallow depth of field. ' +
  'No people, no faces, no hands, no human figures, no body parts. ' +
  'No figurines, statues, dolls, toys, characters, mascots or anthropomorphic / face-like shapes. ' +
  'No text, letters, captions, watermark or logo. ' +
  'Avoid deformed, distorted, mutated, surreal, creepy or grotesque shapes.'

// A concrete, on-topic scene per category so that thin prompts (e.g. after a
// person was stripped out) still render something relevant instead of Flux
// hallucinating random — sometimes creepy — objects.
const CATEGORY_SCENE = {
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

export function sanitizeImagePrompt(raw) {
  let p = String(raw || '').trim()
  // Drop the pre-baked generic style tail; we re-append a stronger one. Anchor on
  // the first style keyword and eat to the end — but NOT "close-up" (that's a
  // composition word that legitimately appears at the start of a prompt).
  p = p.replace(/[,.]?\s*(photorealistic|photo-realistic|natural day ?light|natural daylight|no text|no logos?|no watermark|16:9|9:16)\b[\s\S]*$/i, '')
  // Reframe leading human subjects -> object/scene focus.
  //  "Close-up of hands <verb>ing <the> X" -> "Close-up of X"
  p = p.replace(/^\s*(close-?up of\s+)?(a\s+|an\s+)?(pair of\s+)?hands?\s+\w+?(ing)?\s+(a\s+|an\s+|the\s+)?/i,
    (_m, closeup) => (closeup ? 'Close-up of ' : ''))
  //  "A/An <age> <person|woman|man|child|gardener|cook|angler...> <verb>ing <the> X" -> "X"
  p = p.replace(/^\s*(a\s+|an\s+)?(young\s+|elderly\s+|middle-aged\s+|senior\s+)?(person|people|woman|man|girl|boy|child|kid|gardener|cook|chef|angler|fisherman|housewife|worker|homeowner)\s+\w+?(ing)?\s+(a\s+|an\s+|the\s+)?/i,
    '')
  // Stragglers anywhere in the text.
  p = p.replace(/^\s*(pressing|placing|holding|a|the)?\s*fingers?\s+(into|onto|on|in|against|to)\s+/i, '')
  p = p.replace(/\b(with|using)\s+(her|his|their|a|the)?\s*(bare\s+)?(hands?|fingers?)\b/gi, '')
  p = p.replace(/\bby a (person|woman|man|gardener|cook)\b/gi, '')
  p = p.replace(/\b(human )?(hands?|fingers?)\b/gi, '')
  // Tidy punctuation/whitespace and capitalize.
  p = p.replace(/\s{2,}/g, ' ').replace(/^[\s,.;-]+/, '').trim()
  if (!p) return ''
  p = p.charAt(0).toUpperCase() + p.slice(1)
  if (!/[.!?]$/.test(p)) p += '.'
  return p
}

export function buildImagePrompt(rawPrompt, title, category) {
  const base = sanitizeImagePrompt(rawPrompt) || sanitizeImagePrompt(title) || String(title || '').trim()
  const scene = CATEGORY_SCENE[category]
  // Lead with the category scene only when the base is thin (a stripped person
  // prompt); otherwise it's already concrete enough and the scene would just add
  // noise. ~5 words ≈ the threshold below which Flux tends to improvise.
  const thin = base.split(/\s+/).filter(Boolean).length <= 5
  const lead = scene && thin ? `${scene}: ` : ''
  return `${lead}${base}${IMAGE_STYLE_SUFFIX}`
}

export function verticalForCategory(cat) {
  if (cat === 'dacha-i-ogorod') return 'dacha'
  if (cat === 'dom-i-uborka') return 'dom'
  if (cat === 'kulinaria') return 'recepty'
  if (cat === 'avto') return 'avto'
  if (cat === 'layfkhaki' || cat === 'ekonomiya' || cat === 'rybalka') return 'other'
  return 'other'
}

export default {
  loadEnv,
  getServiceClient,
  wordCount,
  hasMojibake,
  verticalForCategory,
  sanitizeImagePrompt,
  buildImagePrompt,
  IMAGE_STYLE_SUFFIX,
}
