// Publishes only complete, machine-recorded factory output. Shell inputs never
// contain slugs, so workflow dispatch text cannot become command syntax.
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { resolveResultPath } from './factory-runner.mjs'

export function publishArgs(result) {
  const slugs = result?.generated?.map((g) => g?.slug)
  if (!result || result.schema !== 1 || result.ok !== true || result.dryRun === true || result.exitCode !== 0 || !result.counts || result.counts.requested !== slugs?.length || result.counts.generated !== slugs?.length || !Array.isArray(slugs) ||
      !slugs.length || slugs.some((s) => typeof s !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) || new Set(slugs).size !== slugs.length) {
    throw new Error('Factory result is incomplete or contains invalid slugs; refusing to publish.')
  }
  return ['scripts/matrix/publish-dynamic.mjs', '--slugs', slugs.join(','), '--limit', String(slugs.length), '--require-all']
}

export function runPublish(env = process.env, spawn = spawnSync) {
  const p = resolveResultPath(env)
  let result
  try { result = JSON.parse(fs.readFileSync(p, 'utf8')) } catch { throw new Error('Factory result is missing or invalid; refusing to publish.') }
  const args = publishArgs(result)
  return spawn(process.execPath, args, { stdio: 'inherit', env: { ...env } })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const proc = runPublish()
    process.exit(Number.isInteger(proc.status) ? proc.status : 1)
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
}
