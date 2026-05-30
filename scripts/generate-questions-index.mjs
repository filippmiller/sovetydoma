// Snapshot APPROVED questions (and their approved answers) from Supabase into a
// static JSON so /q/[slug] pages can be generated at build time (the site is a
// static export). New questions become indexable on the next build/deploy.
//
//   node scripts/generate-questions-index.mjs
//   → writes src/lib/questions-index.json
//
// Safe to run with no network/keys: on any error it writes an empty array so
// the build never breaks.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'src/lib/questions-index.json')

// Load .env.local for local builds (Vercel injects env directly, so this is a
// no-op there). Keeps the generator self-sufficient without extra tooling.
function loadEnvLocal() {
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* no .env.local — rely on injected env */ }
}
loadEnvLocal()

const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function rest(table, query) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) throw new Error(`${table} ${res.status}`)
  return res.json()
}

// Preserve the already-committed index when we can't fetch fresh data, so a
// build without Supabase env (e.g. on Vercel) never wipes real questions to [].
function keepExisting(reason) {
  let existing = '[]\n'
  let n = 0
  try {
    existing = fs.readFileSync(OUT, 'utf8')
    n = JSON.parse(existing).length
  } catch { /* no committed index yet */ }
  if (!fs.existsSync(OUT)) fs.writeFileSync(OUT, existing)
  console.warn(`[questions-index] ${reason} — keeping committed index (${n} questions)`)
}

async function main() {
  if (!URL || !KEY) { keepExisting('Supabase env not set'); return }
  try {
    const questions = await rest('questions', 'status=eq.approved&select=*&order=created_at.desc')
    const out = []
    for (const q of questions) {
      const answers = await rest(
        'question_answers',
        `question_id=eq.${q.id}&status=eq.approved&select=*&order=created_at.asc`,
      )
      out.push({ ...q, answers })
    }
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
    console.log(`[questions-index] wrote ${out.length} approved questions`)
  } catch (e) {
    keepExisting('fetch failed: ' + e.message)
  }
}

main()
