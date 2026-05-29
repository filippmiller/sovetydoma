#!/usr/bin/env node
// audit-links.mjs — internal linking audit for СоветыДома
// Usage: node scripts/audit-links.mjs

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const articlesDir = path.join(__dirname, '..', 'src', 'content', 'articles')

// Known internal path segments used as href prefixes
const INTERNAL_PREFIXES = [
  '/kulinaria/',
  '/dom-i-uborka/',
  '/sad-i-ogorod/',
  '/ekonomiya/',
  '/na-prirode/',
]

function readArticles() {
  const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.mdx'))
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(articlesDir, file), 'utf8')

    // Extract frontmatter block
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
    const fm = fmMatch ? fmMatch[1] : ''

    const titleMatch = fm.match(/^title:\s*['"]?(.+?)['"]?\s*$/m)
    const slugMatch = fm.match(/^slug:\s*['"]?(.+?)['"]?\s*$/m)
    const categoryMatch = fm.match(/^category:\s*['"]?(.+?)['"]?\s*$/m)

    const title = titleMatch ? titleMatch[1].trim() : file.replace('.mdx', '')
    const slug = slugMatch ? slugMatch[1].trim() : file.replace('.mdx', '')
    const category = categoryMatch ? categoryMatch[1].trim() : ''

    // Body content = everything after frontmatter
    const body = fmMatch ? raw.slice(fmMatch[0].length) : raw

    return { file, title, slug, category, body }
  })
}

function countInternalLinks(body) {
  // Match href="/category/slug" or href='/category/slug' or bare markdown links [text](/cat/slug)
  const hrefPattern = /href=["']?(\/[a-z\-]+\/[a-z\-]+)/g
  const mdLinkPattern = /\]\((\/[a-z\-]+\/[a-z\-]+)/g

  const links = new Set()
  let m
  while ((m = hrefPattern.exec(body)) !== null) links.add(m[1])
  while ((m = mdLinkPattern.exec(body)) !== null) links.add(m[1])

  const internalLinks = [...links].filter((href) =>
    INTERNAL_PREFIXES.some((prefix) => href.startsWith(prefix))
  )
  return internalLinks.length
}

function run() {
  const articles = readArticles()
  console.log(`\nАудит внутренних ссылок — СоветыДома`)
  console.log(`Найдено статей: ${articles.length}\n`)

  // ── 1. Articles with zero internal links ────────────────────────────────
  const noLinks = articles.filter((a) => countInternalLinks(a.body) === 0)
  if (noLinks.length > 0) {
    console.log('── Статьи БЕЗ внутренних ссылок ──────────────────────────────────')
    noLinks.forEach((a) => {
      console.log(`  ⚠  ${a.slug}  («${a.title}»)`)
    })
    console.log()
  } else {
    console.log('✅  Все статьи содержат хотя бы одну внутреннюю ссылку.\n')
  }

  // ── 2. Title-mention vs actual link audit ───────────────────────────────
  console.log('── Упоминания без ссылки ──────────────────────────────────────────')
  let issuesFound = 0

  for (const target of articles) {
    const titleLower = target.title.toLowerCase()
    const expectedHref = `/${target.category}/${target.slug}`

    let mentionCount = 0
    let linkedCount = 0

    for (const other of articles) {
      if (other.slug === target.slug) continue

      const bodyLower = other.body.toLowerCase()
      const mentionsTitle = bodyLower.includes(titleLower)
      const hasLink =
        other.body.includes(`"${expectedHref}"`) ||
        other.body.includes(`'${expectedHref}'`) ||
        other.body.includes(`(${expectedHref})`)

      if (mentionsTitle) mentionCount++
      if (hasLink) linkedCount++
    }

    if (mentionCount > linkedCount) {
      issuesFound++
      console.log(
        `  ⚠  '${target.title}' упоминается в ${mentionCount} стат. но` +
          ` содержит ссылку только в ${linkedCount}`
      )
    }
  }

  if (issuesFound === 0) {
    console.log('  ✅  Все упоминания сопровождаются ссылками.')
  }

  console.log('\nАудит завершён.\n')
}

run()
