import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { auditStaticExport } from '../audit-static-export.mjs'

async function fixture({ copyChunk = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'sovetydoma-export-audit-'))
  await mkdir(path.join(root, '.next', 'static', 'chunks'), { recursive: true })
  await mkdir(path.join(root, 'out', '_next', 'static', 'chunks'), { recursive: true })
  await writeFile(path.join(root, '.next', 'static', 'chunks', 'app.js'), 'console.log("ok")')
  if (copyChunk) {
    await writeFile(path.join(root, 'out', '_next', 'static', 'chunks', 'app.js'), 'console.log("ok")')
  }
  await writeFile(
    path.join(root, 'out', 'index.html'),
    '<script src="/_next/static/chunks/app.js"></script>',
  )
  return root
}

test('accepts a complete static export', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))

  const result = await auditStaticExport({ root })
  assert.equal(result.javascriptChunks, 1)
  assert.equal(result.homepageReferences, 1)
})

test('rejects a Next asset omitted from the exported site', async (t) => {
  const root = await fixture({ copyChunk: false })
  t.after(() => rm(root, { recursive: true, force: true }))

  await assert.rejects(
    auditStaticExport({ root }),
    /Static export is missing 1 Next asset.*chunks\/app\.js/s,
  )
})

test('accepts asset references embedded in escaped Next payloads', async (t) => {
  const root = await fixture()
  t.after(() => rm(root, { recursive: true, force: true }))
  await writeFile(
    path.join(root, 'out', 'index.html'),
    '<script>self.__next_f.push([1,"/_next/static/chunks/app.js\\\\"])<\/script>',
  )

  const result = await auditStaticExport({ root })
  assert.equal(result.homepageReferences, 1)
})
