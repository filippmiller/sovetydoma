#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

function gitValue(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const root = path.join(import.meta.dirname, '..')
const metadata = {
  sha: process.env.GITHUB_SHA || gitValue(['rev-parse', 'HEAD']),
  shortSha: (process.env.GITHUB_SHA || gitValue(['rev-parse', 'HEAD'])).slice(0, 12),
  branch: process.env.GITHUB_REF_NAME || gitValue(['branch', '--show-current']),
  builtAt: new Date().toISOString(),
  site: process.env.NEXT_PUBLIC_SITE_URL || 'https://1001sovet.ru',
}

fs.mkdirSync(path.join(root, 'public'), { recursive: true })
fs.writeFileSync(path.join(root, 'public', 'build.json'), `${JSON.stringify(metadata, null, 2)}\n`)
console.log(`Generated build metadata for ${metadata.shortSha || 'unknown sha'}`)
