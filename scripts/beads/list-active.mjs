import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const beadsDir = path.join(root, '.beads')
const active = new Set(['todo', 'running', 'blocked', 'review'])

function readStatus(dir) {
  const statusPath = path.join(beadsDir, dir, 'status.json')
  if (!fs.existsSync(statusPath)) return null
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf8'))
  } catch {
    return { beadId: dir, status: 'invalid', title: 'Invalid status.json' }
  }
}

const rows = fs.readdirSync(beadsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('BEAD-'))
  .map((entry) => readStatus(entry.name))
  .filter(Boolean)
  .filter((status) => active.has(status.status) || status.status === 'invalid')
  .sort((a, b) => String(a.beadId).localeCompare(String(b.beadId)))

if (rows.length === 0) {
  console.log('No active beads.')
  process.exit(0)
}

for (const row of rows) {
  console.log(`${row.beadId}\t${row.status}\t${row.priority || ''}\t${row.title || ''}`)
}
