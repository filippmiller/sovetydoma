#!/usr/bin/env node
// check-freshness.mjs — article freshness checker for СоветыДома
// Usage: node scripts/check-freshness.mjs

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const articlesDir = path.join(__dirname, '..', 'src', 'content', 'articles')

const STALE_DAYS = 365      // older than this → ❌ Stale
const REVIEW_DAYS = 180     // older than this with no 'updated' → ⚠ Review

function daysSince(dateStr) {
  const then = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

function parseFrontmatter(raw) {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return {}
  const fm = fmMatch[1]

  const get = (key) => {
    const m = fm.match(new RegExp(`^${key}:\\s*['"]?(.+?)['"]?\\s*$`, 'm'))
    return m ? m[1].trim() : undefined
  }

  return {
    slug: get('slug'),
    title: get('title'),
    date: get('date'),
    updated: get('updated'),
  }
}

function status(age, hasUpdated) {
  if (age > STALE_DAYS) return '❌ Stale'
  if (!hasUpdated && age > REVIEW_DAYS) return '⚠ Review'
  return '✅ Fresh'
}

function padEnd(str, len) {
  // pad with spaces, accounting for multi-byte emoji chars counted as 1 col each
  const visible = [...str].length   // approximate; good enough for a CLI table
  return str + ' '.repeat(Math.max(0, len - visible))
}

function run() {
  const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.mdx'))

  const rows = files.map((file) => {
    const raw = fs.readFileSync(path.join(articlesDir, file), 'utf8')
    const { slug, title, date, updated } = parseFrontmatter(raw)

    const effectiveDate = updated && updated > (date || '') ? updated : date
    const age = effectiveDate ? daysSince(effectiveDate) : 9999
    const hasUpdated = Boolean(updated)
    const st = status(age, hasUpdated)

    return {
      slug: slug || file.replace('.mdx', ''),
      date: date || '—',
      updated: updated || '—',
      age: effectiveDate ? `${age}d` : '???',
      status: st,
    }
  })

  // Sort: stale first, then by age descending
  rows.sort((a, b) => {
    const order = { '❌ Stale': 0, '⚠ Review': 1, '✅ Fresh': 2 }
    const oa = order[a.status] ?? 3
    const ob = order[b.status] ?? 3
    if (oa !== ob) return oa - ob
    return parseInt(b.age) - parseInt(a.age)
  })

  // Column widths
  const COL = {
    slug:    Math.max(4, ...rows.map((r) => r.slug.length)),
    date:    10,
    updated: 10,
    age:     6,
    status:  10,
  }

  const sep = `+${'-'.repeat(COL.slug + 2)}+${'-'.repeat(COL.date + 2)}+${'-'.repeat(COL.updated + 2)}+${'-'.repeat(COL.age + 2)}+${'-'.repeat(COL.status + 2)}+`
  const header =
    `| ${padEnd('Slug', COL.slug)} | ${padEnd('Date', COL.date)} | ${padEnd('Updated', COL.updated)} | ${padEnd('Age', COL.age)} | ${padEnd('Status', COL.status)} |`

  console.log(`\nПроверка актуальности статей — СоветыДома`)
  console.log(`Дата проверки: ${new Date().toISOString().slice(0, 10)}\n`)
  console.log(sep)
  console.log(header)
  console.log(sep)

  for (const r of rows) {
    const line =
      `| ${padEnd(r.slug, COL.slug)} | ${padEnd(r.date, COL.date)} | ${padEnd(r.updated, COL.updated)} | ${padEnd(r.age, COL.age)} | ${padEnd(r.status, COL.status)} |`
    console.log(line)
  }

  console.log(sep)

  const stale  = rows.filter((r) => r.status === '❌ Stale').length
  const review = rows.filter((r) => r.status === '⚠ Review').length
  const fresh  = rows.filter((r) => r.status === '✅ Fresh').length

  console.log(`\nИтого: ${rows.length} статей — ✅ ${fresh} актуальных · ⚠ ${review} требуют проверки · ❌ ${stale} устаревших\n`)

  if (stale > 0 || review > 0) {
    console.log('Рекомендация: обновите устаревшие статьи и добавьте поле "updated:" во frontmatter.')
    console.log()
  }
}

run()
