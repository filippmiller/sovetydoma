// Guards against the exact regression found 2026-07-30: /about/ shipped with
// `export const metadata` but no canonical URL, which Yandex Webmaster flagged
// as an exclusion reason ("Канонический адрес не указан") and dropped the page
// from its index. Every static route's metadata must declare either a
// canonical URL or an explicit noindex — silence in either direction is a bug.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const appDir = path.join(root, 'src/app')

function findPageFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      findPageFiles(full, out)
    } else if (entry.name === 'page.tsx') {
      out.push(full)
    }
  }
  return out
}

const failures = []

for (const file of findPageFiles(appDir)) {
  const content = fs.readFileSync(file, 'utf8')
  if (!/export const metadata/.test(content)) continue // dynamic routes use generateMetadata, out of scope here

  const hasCanonical = /alternates/.test(content)
  const hasNoindex = /robots\s*:\s*\{[^}]*index\s*:\s*false/.test(content) || /noindex/.test(content)

  if (!hasCanonical && !hasNoindex) {
    const rel = path.relative(root, file).replace(/\\/g, '/')
    failures.push(`${rel}: has 'export const metadata' with neither alternates.canonical nor robots noindex`)
  }
}

if (failures.length > 0) {
  console.error(`Page metadata audit failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  console.error('\nFix: add `alternates: { canonical: canonicalPath(\'/your-path/\') }` (see src/lib/seo.ts),')
  console.error('or `robots: { index: false }` if the page should not be indexed (account/utility pages).')
  process.exit(1)
}

console.log('Page metadata audit passed.')
