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

export function verticalForCategory(cat) {
  if (cat === 'dacha-i-ogorod') return 'dacha'
  if (cat === 'dom-i-uborka') return 'dom'
  if (cat === 'kulinaria') return 'recepty'
  if (cat === 'layfkhaki' || cat === 'ekonomiya' || cat === 'rybalka') return 'other'
  return 'other'
}

export default {
  loadEnv,
  getServiceClient,
  wordCount,
  hasMojibake,
  verticalForCategory,
}
