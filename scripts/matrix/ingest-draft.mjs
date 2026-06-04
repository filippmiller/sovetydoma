// ingest-draft.mjs — read a Kimi-written article body file into a content_matrix row.
// Usage: node scripts/matrix/ingest-draft.mjs --id <uuid> --file <path.md>
import fs from 'node:fs'
import helpers from './lib.mjs'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const id = arg('--id')
const file = arg('--file')
if (!id || !file || !fs.existsSync(file)) { console.error('need --id and existing --file'); process.exit(1) }

let body = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim()
// strip accidental ``` fences or leading H1
body = body.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '').trim()
body = body.replace(/^#\s+.*\n+/, '').trim()
const wc = helpers.wordCount(body)
if (wc < 250) { console.error(`draft too short (${wc} words) — not saving`); process.exit(2) }

const sb = helpers.getServiceClient()
const { data: before } = await sb.from('content_matrix').select('text_status').eq('id', id).single()
const { error } = await sb.from('content_matrix').update({
  body_md: body, word_count: wc, text_status: 'draft', last_filled_stage: 'draft',
}).eq('id', id)
if (error) { console.error('update error:', error.message); process.exit(1) }
await sb.from('content_matrix_events').insert({ matrix_id: id, axis: 'text', from_value: before?.text_status || 'idea', to_value: 'draft', agent: 'kimi-draft', notes: `${wc} words` })
console.log(`ok draft ${id} (${wc} words)`)
