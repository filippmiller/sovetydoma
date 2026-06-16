#!/usr/bin/env node
// Infer `seasonalMonths` for articles from tags and title keywords.
// Idempotent: skips articles that already have seasonalMonths.
// Run with --apply to write files; default is dry-run.

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const root = path.join(import.meta.dirname, '..')
const articlesDir = path.join(root, 'src', 'content', 'articles')
const apply = process.argv.includes('--apply')

const KEYWORDS: Array<[string | RegExp, number[]]> = [
  ['зима', [12, 1, 2]],
  ['зимой', [12, 1, 2]],
  ['зимний', [12, 1, 2]],
  ['январь', [1]],
  ['январе', [1]],
  ['февраль', [2]],
  ['феврале', [2]],
  ['декабрь', [12]],
  ['декабре', [12]],
  ['весна', [3, 4, 5]],
  ['весной', [3, 4, 5]],
  ['весенний', [3, 4, 5]],
  ['март', [3]],
  ['марте', [3]],
  ['апрель', [4]],
  ['апреле', [4]],
  ['май', [5]],
  ['мае', [5]],
  ['лето', [6, 7, 8]],
  ['летом', [6, 7, 8]],
  ['летний', [6, 7, 8]],
  ['июнь', [6]],
  ['июне', [6]],
  ['июль', [7]],
  ['июле', [7]],
  ['август', [8]],
  ['августе', [8]],
  ['осень', [9, 10, 11]],
  ['осенью', [9, 10, 11]],
  ['осенний', [9, 10, 11]],
  ['сентябрь', [9]],
  ['сентябре', [9]],
  ['октябрь', [10]],
  ['октябре', [10]],
  ['ноябрь', [11]],
  ['ноябре', [11]],
]

function inferMonths(data) {
  const text = `${data.title || ''} ${(data.tags || []).join(' ')}`.toLowerCase()
  const months = new Set()
  for (const [pattern, values] of KEYWORDS) {
    const matches = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text)
    if (matches) {
      for (const v of values) months.add(v)
    }
  }
  return Array.from(months).sort((a, b) => a - b)
}

const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.mdx'))
let drafted = 0
let skipped = 0
let errors = 0

for (const file of files) {
  const filePath = path.join(articlesDir, file)
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = matter(raw)
    if (parsed.data.seasonalMonths?.length) {
      skipped++
      continue
    }
    const months = inferMonths(parsed.data)
    if (months.length === 0) {
      skipped++
      continue
    }
    drafted++
    console.log(`[${apply ? 'WRITE' : 'DRAFT'}] ${file} → [${months.join(', ')}]`)
    if (apply) {
      parsed.data.seasonalMonths = months
      fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data))
    }
  } catch (err) {
    errors++
    console.error(`[ERROR] ${file}: ${err.message}`)
  }
}

console.log(`\nDone. drafted=${drafted} skipped=${skipped} errors=${errors}`)
if (!apply) {
  console.log('Dry run. Add --apply to write inferred seasonalMonths to disk.')
}
process.exit(errors > 0 ? 1 : 0)
