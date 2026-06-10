// validate-style.mjs — flag AI-tone markers in article bodies so drafts read human.
// Heuristic, not a gate by default: prints a per-file score and the worst offenders.
// Usage:
//   node scripts/validate-style.mjs                 # scan src/content/articles
//   node scripts/validate-style.mjs path/to.mdx ... # scan specific files
//   node scripts/validate-style.mjs --dir matrix-exports
//   node scripts/validate-style.mjs --fail 5        # exit 1 if any file scores >= 5
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const explicitFiles = process.argv.slice(2).filter((a) => a.endsWith('.mdx') || a.endsWith('.md'))
const dir = path.resolve(arg('--dir', 'src/content/articles'))
const failAt = arg('--fail', null) ? parseInt(arg('--fail'), 10) : null

// Each pattern carries a weight; higher = stronger AI smell.
const CLICHES = [
  [/\bв этой статье\b/iu, 3, 'клише «в этой статье»'],
  [/\bдавайте (?:разбер|рассмотр|поговорим)/iu, 3, 'клише «давайте разберёмся»'],
  [/\bв современном мире\b/iu, 3, 'клише «в современном мире»'],
  [/\bне секрет,? что\b/iu, 3, 'клише «не секрет, что»'],
  [/\b(?:важно|стоит|следует|нужно) отметить\b/iu, 2, 'клише «стоит отметить»'],
  [/\b(?:в заключение|подводя итог|подытожив)\b/iu, 3, 'дежурное заключение'],
  [/\bнадеюсь,? (?:эта )?(?:статья|информация) (?:вам )?(?:помогл|была полезн)/iu, 3, 'клише «надеюсь, помогло»'],
  [/\b(?:играет|играют) (?:важную|ключевую|значимую) роль\b/iu, 2, 'штамп «играет важную роль»'],
  [/\bнеотъемлемой частью\b/iu, 2, 'штамп «неотъемлемая часть»'],
  [/\bширок(?:ий|ого|ому) (?:спектр|выбор|ассортимент)\b/iu, 1, 'штамп «широкий спектр»'],
  // Канцелярит / robotic register
  [/\bявляется\b/iu, 1, 'канцелярит «является»'],
  [/\bосуществл(?:ять|ение|яется)\b/iu, 1, 'канцелярит «осуществлять»'],
  [/\bданн(?:ый|ая|ое|ые) (?:способ|метод|процесс|вариант|подход)\b/iu, 1, 'канцелярит «данный»'],
  [/\bв случае,? если\b/iu, 1, 'канцелярит «в случае если»'],
  [/\bнеобходимо обеспечить\b/iu, 1, 'канцелярит «необходимо обеспечить»'],
  // Empty intensifiers (count occurrences)
  [/\bдействительно\b/giu, 0.5, 'усилитель «действительно»'],
  [/\bнесомненно\b/giu, 1, 'усилитель «несомненно»'],
  [/\bпоистине\b/giu, 1, 'усилитель «поистине»'],
  [/\bпо-настоящему\b/giu, 0.5, 'усилитель «по-настоящему»'],
]

function sentenceVariety(text) {
  const sentences = text.replace(/\n+/g, ' ').split(/(?<=[.!?…])\s+/u).map((s) => s.trim()).filter((s) => s.length > 0)
  if (sentences.length < 6) return { penalty: 0, note: '' }
  const lengths = sentences.map((s) => s.split(/\s+/).length)
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length
  const sd = Math.sqrt(variance)
  // Uniform sentence length (low standard deviation) reads robotic.
  if (sd < 3 && mean > 8) return { penalty: 2, note: `однообразная длина предложений (sd=${sd.toFixed(1)})` }
  return { penalty: 0, note: '' }
}

function scoreText(body) {
  const hits = []
  let score = 0
  for (const [re, weight, label] of CLICHES) {
    if (re.flags.includes('g')) {
      const m = body.match(re)
      if (m && m.length) { score += weight * m.length; hits.push(`${label} ×${m.length}`) }
    } else if (re.test(body)) {
      score += weight; hits.push(label)
    }
  }
  const variety = sentenceVariety(body)
  if (variety.penalty) { score += variety.penalty; hits.push(variety.note) }
  return { score: Math.round(score * 10) / 10, hits }
}

function collectFiles() {
  if (explicitFiles.length) return explicitFiles.map((f) => path.resolve(f))
  if (!fs.existsSync(dir)) { console.error(`dir not found: ${dir}`); process.exit(2) }
  return fs.readdirSync(dir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md')).map((f) => path.join(dir, f))
}

const files = collectFiles()
const results = []
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8')
  const { content } = matter(raw)
  const { score, hits } = scoreText(content)
  results.push({ file: path.basename(file), score, hits })
}

results.sort((a, b) => b.score - a.score)
const flagged = results.filter((r) => r.score > 0)
const worst = results.filter((r) => r.score >= 3)

console.log(`Scanned ${results.length} file(s). ${flagged.length} have AI-tone markers; ${worst.length} score >= 3.\n`)
for (const r of results.slice(0, 25)) {
  if (r.score === 0) continue
  console.log(`  ${r.score.toString().padStart(5)}  ${r.file}`)
  console.log(`         ${r.hits.join('; ')}`)
}

const avg = results.length ? (results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(2) : '0'
console.log(`\nAverage AI-tone score: ${avg} (lower is more human).`)

if (failAt !== null) {
  const over = results.filter((r) => r.score >= failAt)
  if (over.length) {
    console.error(`\nFAIL: ${over.length} file(s) score >= ${failAt}: ${over.map((r) => r.file).join(', ')}`)
    process.exit(1)
  }
}
