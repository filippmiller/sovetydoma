// auto-publish.mjs — end-to-end: pick ready matrix rows, export MDX into
// src/content/articles, validate, commit + push (deploy workflow takes it from there),
// then mark rows published in the matrix.
// Usage: node scripts/matrix/auto-publish.mjs [--limit 2] [--status approved]
//        [--dry-run] [--no-push] [--agent auto-publish]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import matter from 'gray-matter'
import { CATEGORIES } from '../../src/lib/categories.mjs'
import helpers from './lib.mjs'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const has = (k) => process.argv.includes(k)

const limit = parseInt(arg('--limit', '2'), 10)
const statuses = (arg('--status', 'approved')).split(',')
const dryRun = has('--dry-run')
const noPush = has('--no-push')
const agent = arg('--agent', 'auto-publish')
const DOMAIN = '1001sovet.ru'
const PERSONA = {
  kulinaria: 'maryana-sidorova', 'dom-i-uborka': 'maryana-sidorova',
  'dacha-i-ogorod': 'petr-ivanov', ekonomiya: 'petr-ivanov',
  layfkhaki: 'petr-pupkin', rybalka: 'andrey-rybak',
}

const ROOT = process.cwd()
const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles')
const IMAGES_DIR = path.join(ROOT, 'public', 'images')
const TODAY = new Date().toISOString().slice(0, 10)

const sb = helpers.getServiceClient()

const { data, error } = await sb.from('content_matrix')
  .select('*').eq('domain', DOMAIN).eq('disposition', 'active')
  .in('text_status', statuses)
  .in('image_status', ['generated', 'approved'])
  .not('body_md', 'is', null).not('image_filename', 'is', null)
  .order('updated_at', { ascending: true })
  .limit(limit * 3) // overfetch: some rows get skipped below
if (error) { console.error('matrix query error:', error.message); process.exit(1) }

const picked = []
for (const r of data || []) {
  if (picked.length >= limit) break
  if (!CATEGORIES[r.category]) { console.warn(`skip ${r.slug}: bad category ${r.category}`); continue }
  if (fs.existsSync(path.join(ARTICLES_DIR, `${r.slug}.mdx`))) { console.warn(`skip ${r.slug}: MDX already exists`); continue }
  if (!fs.existsSync(path.join(IMAGES_DIR, r.image_filename))) { console.warn(`skip ${r.slug}: image missing public/images/${r.image_filename}`); continue }
  if (helpers.hasMojibake(r.title) || helpers.hasMojibake(r.body_md)) { console.warn(`skip ${r.slug}: mojibake detected`); continue }
  picked.push(r)
}

if (picked.length === 0) {
  console.log('Nothing ready to publish.')
  process.exit(0)
}

console.log(`Publishing ${picked.length} article(s): ${picked.map((r) => r.slug).join(', ')}${dryRun ? ' [dry-run]' : ''}`)
if (dryRun) process.exit(0)

const writtenFiles = []
for (const r of picked) {
  const cat = CATEGORIES[r.category]
  const fm = r.frontmatter && typeof r.frontmatter === 'object' ? { ...r.frontmatter } : {}
  delete fm.target_wc
  const front = {
    title: r.title,
    slug: r.slug,
    category: r.category,
    categoryName: cat.name,
    description: r.description || '',
    date: TODAY,
    image: `/images/${r.image_filename}`,
    tags: Array.isArray(r.tags) && r.tags.length ? r.tags : ['советы'],
    author: fm.author || PERSONA[r.category] || 'maryana-sidorova',
    ...fm,
  }
  const mdx = matter.stringify('\n' + (r.body_md || '').trim() + '\n', front)
  const file = path.join(ARTICLES_DIR, `${r.slug}.mdx`)
  fs.writeFileSync(file, mdx, 'utf8')
  writtenFiles.push(file)
}

const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })

// Validate the whole content dir; roll back our files on failure.
try {
  run('node', ['scripts/validate-articles.mjs'])
} catch {
  console.error('Validation failed — rolling back exported files.')
  for (const f of writtenFiles) { try { fs.unlinkSync(f) } catch { /* already gone */ } }
  process.exit(1)
}

const relFiles = [
  ...writtenFiles.map((f) => path.relative(ROOT, f)),
  ...picked.map((r) => path.join('public', 'images', r.image_filename)),
]
run('git', ['add', ...relFiles])
run('git', ['commit', '-m', `content: auto-publish ${picked.length} article(s)\n\n${picked.map((r) => `- ${r.slug}`).join('\n')}`])

if (!noPush) {
  run('git', ['push'])
}

// Only after a successful push do we flip matrix status to published.
for (const r of picked) {
  const { error: updErr } = await sb.from('content_matrix')
    .update({ text_status: 'published', published_at: new Date().toISOString() })
    .eq('id', r.id)
  if (updErr) { console.error(`mark published failed for ${r.slug}:`, updErr.message); continue }
  await sb.from('content_matrix_events').insert({
    matrix_id: r.id, axis: 'text', from_value: r.text_status, to_value: 'published',
    agent, notes: noPush ? 'auto-publish (no push)' : 'auto-publish (pushed)',
  })
}

console.log(`Done. ${picked.length} article(s) committed${noPush ? '' : ' and pushed — deploy workflow will publish them'}.`)
