import fs from 'node:fs'
import path from 'node:path'

const [beadIdArg, ...titleParts] = process.argv.slice(2)
if (!beadIdArg || titleParts.length === 0) {
  console.error('Usage: node scripts/beads/create-bead.mjs BEAD-OPS-001 "Short title"')
  process.exit(1)
}

const beadId = beadIdArg.toUpperCase()
if (!/^BEAD-[A-Z0-9]+-\d{3,}$/.test(beadId) && !/^BEAD-\d{4,}$/.test(beadId)) {
  console.error('Invalid bead id. Use BEAD-OPS-001 or BEAD-0001 style.')
  process.exit(1)
}

const title = titleParts.join(' ').trim()
const root = process.cwd()
const beadDir = path.join(root, '.beads', beadId)
const templateDir = path.join(root, '.beads', 'TEMPLATES')

if (fs.existsSync(beadDir)) {
  console.error(`Bead already exists: ${beadDir}`)
  process.exit(1)
}

const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 48) || 'task'
const now = new Date().toISOString()
const branch = `codex/${beadId.toLowerCase()}-${slug}`
const worktree = `../sovetydoma-${beadId}`

fs.mkdirSync(beadDir, { recursive: true })
for (const fileName of ['spec.md', 'result.md', 'review.md', 'handoff.md']) {
  const source = path.join(templateDir, fileName)
  const target = path.join(beadDir, fileName)
  let content = fs.readFileSync(source, 'utf8')
  content = content.replaceAll('<BEAD-ID>', beadId)
  fs.writeFileSync(target, content, 'utf8')
}

const status = JSON.parse(fs.readFileSync(path.join(templateDir, 'status.json'), 'utf8'))
Object.assign(status, {
  beadId,
  title,
  branch,
  worktree,
  createdAt: now,
  updatedAt: now,
  summary: title,
})
fs.writeFileSync(path.join(beadDir, 'status.json'), `${JSON.stringify(status, null, 2)}\n`, 'utf8')

console.log(`Created ${path.relative(root, beadDir)}`)
