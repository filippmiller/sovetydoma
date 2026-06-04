// ingest-drafts-batch.mjs — ingest all .md files in .matrix-ideas/drafts/ into matrix rows (by slug).
// Only advances rows currently in text_status='idea' (won't clobber already-drafted/published).
import fs from 'node:fs'
import path from 'node:path'
import helpers from './lib.mjs'
const DOMAIN = '1001sovet.ru'
const DIR = path.join('C:/DEV/sovetydoma', '.matrix-ideas', 'drafts')
const sb = helpers.getServiceClient()
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md'))
let ok = 0, skipShort = 0, skipNoRow = 0, skipAlready = 0
for (const f of files) {
  const slug = f.replace(/\.md$/, '')
  let body = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/^﻿/, '').trim()
  body = body.replace(/^```(?:markdown|md)?\s*/i, '').replace(/\s*```$/i, '').replace(/^#\s+.*\n+/, '').trim()
  const wc = helpers.wordCount(body)
  if (wc < 250) { skipShort++; continue }
  const { data: row } = await sb.from('content_matrix').select('id,text_status').eq('domain', DOMAIN).eq('slug', slug).maybeSingle()
  if (!row) { skipNoRow++; continue }
  if (row.text_status !== 'idea') { skipAlready++; continue }
  const { error } = await sb.from('content_matrix').update({ body_md: body, word_count: wc, text_status: 'draft', last_filled_stage: 'draft', review_agent: 'sonnet-draft' }).eq('id', row.id)
  if (error) { console.error(slug, error.message); continue }
  await sb.from('content_matrix_events').insert({ matrix_id: row.id, axis: 'text', from_value: 'idea', to_value: 'draft', agent: 'sonnet-draft', notes: `${wc} words` })
  ok++
}
const { count } = await sb.from('content_matrix').select('*', { count: 'exact', head: true }).eq('domain', DOMAIN).eq('text_status', 'draft')
console.log(`ingested=${ok} | short=${skipShort} | no-row=${skipNoRow} | already-advanced=${skipAlready} | total drafts now: ${count}`)
