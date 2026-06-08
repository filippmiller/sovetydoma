import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const beadsDir = path.join(root, '.beads')
const required = ['beadId', 'title', 'status', 'priority', 'branch', 'worktree', 'owner', 'createdAt', 'updatedAt', 'dependsOn', 'blockedBy', 'summary']
const allowedStatuses = new Set(['todo', 'running', 'blocked', 'review', 'done', 'cancelled'])
let failures = 0

function fail(file, message) {
  failures += 1
  console.error(`${path.relative(root, file)}: ${message}`)
}

const templatePath = path.join(beadsDir, 'TEMPLATES', 'status.json')
for (const file of [templatePath]) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    fail(file, `invalid JSON: ${err.message}`)
  }
}

const beadDirs = fs.existsSync(beadsDir)
  ? fs.readdirSync(beadsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith('BEAD-'))
  : []

for (const entry of beadDirs) {
  const file = path.join(beadsDir, entry.name, 'status.json')
  if (!fs.existsSync(file)) {
    fail(file, 'missing status.json')
    continue
  }
  let status
  try {
    status = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    fail(file, `invalid JSON: ${err.message}`)
    continue
  }
  for (const key of required) {
    if (!(key in status)) fail(file, `missing required field ${key}`)
  }
  if (!allowedStatuses.has(status.status)) fail(file, `invalid status ${status.status}`)
  if (!Array.isArray(status.dependsOn)) fail(file, 'dependsOn must be an array')
  if (!Array.isArray(status.blockedBy)) fail(file, 'blockedBy must be an array')
}

if (failures > 0) process.exit(1)
console.log(`Validated ${beadDirs.length} bead status file(s) and template.`)
