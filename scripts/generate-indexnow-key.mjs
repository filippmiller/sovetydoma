/**
 * Generate the IndexNow key file for static hosting.
 *
 * Usage:
 *   INDEXNOW_KEY=your-secret-key node scripts/generate-indexnow-key.mjs
 *
 * This creates public/indexnow-key.txt containing the key.
 * The keyLocation is then https://1001sovet.ru/indexnow-key.txt
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const KEY = process.env.INDEXNOW_KEY || ''

if (!KEY) {
  console.error('[generate-indexnow-key] ERROR: INDEXNOW_KEY is not set')
  process.exit(1)
}

if (!/^[a-zA-Z0-9]{8,128}$/.test(KEY)) {
  console.error('[generate-indexnow-key] ERROR: INDEXNOW_KEY should be 8-128 alphanumeric characters')
  process.exit(1)
}

const outPath = path.join(__dirname, '../public/indexnow-key.txt')
fs.writeFileSync(outPath, KEY)
console.log(`[generate-indexnow-key] Written ${outPath}`)
