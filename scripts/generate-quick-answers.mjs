#!/usr/bin/env node
// Draft missing `quickAnswer` frontmatter values for MDX articles.
// Idempotent: skips files that already have a non-empty quickAnswer.
// Run with --apply to write files; default is a dry-run preview.

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const root = path.join(import.meta.dirname, '..')
const articlesDir = path.join(root, 'src', 'content', 'articles')
const apply = process.argv.includes('--apply')

const TARGET_MIN = 40
const TARGET_MAX = 60

function stripMarkdown(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*`>_~]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function pickSentences(text) {
  const sents = sentences(text)
  let picked = ''
  for (const s of sents) {
    const next = picked ? `${picked} ${s}` : s
    const wc = wordCount(next)
    if (wc >= TARGET_MIN) {
      picked = next
      break
    }
    picked = next
  }
  if (wordCount(picked) > TARGET_MAX) {
    const words = picked.split(/\s+/)
    picked = words.slice(0, TARGET_MAX).join(' ') + '…'
  }
  return picked.trim()
}

function draftQuickAnswer({ data, content, description }) {
  if (data.quickAnswer?.trim()) return null
  const source = content ? stripMarkdown(content.split('---').slice(2).join('---') || content) : ''
  const firstPara = source.split(/\n\s*\n/).find((p) => p.trim().length > 0) || ''
  let answer = pickSentences(firstPara)
  if (wordCount(answer) < TARGET_MIN && description) {
    answer = pickSentences(description)
  }
  if (wordCount(answer) < 10) return null
  return answer
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
    if (parsed.data.quickAnswer?.trim()) {
      skipped++
      continue
    }
    const answer = draftQuickAnswer({
      data: parsed.data,
      content: parsed.content,
      description: parsed.data.description,
    })
    if (!answer) {
      skipped++
      continue
    }
    drafted++
    console.log(`[${apply ? 'WRITE' : 'DRAFT'}] ${file} — ${wordCount(answer)} words`)
    if (apply) {
      parsed.data.quickAnswer = answer
      fs.writeFileSync(filePath, matter.stringify(parsed.content, parsed.data))
    }
  } catch (err) {
    errors++
    console.error(`[ERROR] ${file}: ${err.message}`)
  }
}

console.log(`\nDone. drafted=${drafted} skipped=${skipped} errors=${errors}`)
if (!apply) {
  console.log('This was a dry run. Add --apply to write the generated quickAnswers to disk.')
}
process.exit(errors > 0 ? 1 : 0)
