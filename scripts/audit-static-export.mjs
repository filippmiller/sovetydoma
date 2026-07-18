import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolute = path.join(current, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute))
    else if (entry.isFile()) files.push(path.relative(root, absolute).replaceAll(path.sep, '/'))
  }

  return files
}

async function assertDirectory(directory, label) {
  let info
  try {
    info = await stat(directory)
  } catch {
    throw new Error(`${label} not found: ${directory}`)
  }
  if (!info.isDirectory()) throw new Error(`${label} is not a directory: ${directory}`)
}

export async function auditStaticExport({ root = process.cwd() } = {}) {
  const nextStatic = path.join(root, '.next', 'static')
  const exportedStatic = path.join(root, 'out', '_next', 'static')
  const exportedIndex = path.join(root, 'out', 'index.html')

  await assertDirectory(nextStatic, 'Next static assets directory')
  await assertDirectory(exportedStatic, 'Exported static assets directory')

  const [builtFiles, exportedFiles, indexHtml] = await Promise.all([
    listFiles(nextStatic),
    listFiles(exportedStatic),
    readFile(exportedIndex, 'utf8'),
  ])
  const exported = new Set(exportedFiles)
  const missingFromExport = builtFiles.filter((file) => !exported.has(file))

  if (missingFromExport.length > 0) {
    throw new Error(
      `Static export is missing ${missingFromExport.length} Next asset(s):\n` +
      missingFromExport.slice(0, 25).map((file) => `- ${file}`).join('\n'),
    )
  }

  const chunkFiles = exportedFiles.filter((file) => file.startsWith('chunks/') && file.endsWith('.js'))
  if (chunkFiles.length === 0) throw new Error('Static export contains no JavaScript chunks')

  const referencedAssets = new Set(
    [...indexHtml.matchAll(/\/_next\/static\/([^"'<>\s)]+)/g)]
      .map((match) => match[1].replace(/\\+$/, '')),
  )
  const missingIndexAssets = [...referencedAssets].filter((file) => !exported.has(file))
  if (missingIndexAssets.length > 0) {
    throw new Error(
      `Homepage references ${missingIndexAssets.length} missing static asset(s):\n` +
      missingIndexAssets.map((file) => `- ${file}`).join('\n'),
    )
  }

  return {
    builtAssets: builtFiles.length,
    exportedAssets: exportedFiles.length,
    javascriptChunks: chunkFiles.length,
    homepageReferences: referencedAssets.size,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await auditStaticExport()
    console.log(
      `Static export integrity OK: ${result.exportedAssets} assets, ` +
      `${result.javascriptChunks} JS chunks, ${result.homepageReferences} homepage references.`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
