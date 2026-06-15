import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export function getLocalJpegDimensions(imagePath: string): { width: number; height: number } | null {
  const normalized = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath
  const filePath = path.join(process.cwd(), 'public', normalized)
  if (!existsSync(filePath)) return null

  const bytes = readFileSync(filePath)
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = bytes[offset + 1]
    const length = bytes.readUInt16BE(offset + 2)
    if (length < 2) return null
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      }
    }
    offset += 2 + length
  }

  return null
}
