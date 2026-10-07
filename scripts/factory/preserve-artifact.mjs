import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveResultPath } from './factory-runner.mjs'

export function preserveArtifact(env = process.env, io = fs) {
  const sourceResult = resolveResultPath(env)
  if (!io.existsSync(sourceResult)) return { directory: null, copiedImages: [] }
  let result
  try { result = JSON.parse(io.readFileSync(sourceResult, 'utf8')) } catch { return { directory: null, copiedImages: [] } }
  if (!Array.isArray(result?.generated) || !Number.isInteger(result?.counts?.generated) || result.counts.generated < 0 || result.counts.generated !== result.generated.length) {
    throw new Error('Factory generated-image metadata does not match the result counts.')
  }
  const sources = result.generated.map((item) => {
    const slug = item?.slug
    const filename = item?.imageFilename
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || filename !== `${slug}.jpg` || path.basename(filename) !== filename) {
      throw new Error('Factory result contains an unsafe generated image filename.')
    }
    return filename
  })
  const dest = path.join(env.RUNNER_TEMP || path.dirname(sourceResult), `content-factory-artifacts-${env.GITHUB_RUN_ID || 'local'}-${env.GITHUB_RUN_ATTEMPT || '1'}`)
  const imagesDir = path.join(dest, 'images')
  io.mkdirSync(imagesDir, { recursive: true })
  io.copyFileSync(sourceResult, path.join(dest, 'result.json'))
  const copiedImages = []
  for (const filename of sources) {
    const sourceImage = path.join(env.FACTORY_IMAGES_DIR || path.join(process.cwd(), 'public', 'images'), filename)
    if (!io.existsSync(sourceImage)) throw new Error(`Generated image is missing: ${filename}`)
    io.copyFileSync(sourceImage, path.join(imagesDir, filename))
    copiedImages.push(filename)
  }
  return { directory: dest, copiedImages }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = preserveArtifact()
    console.log(result.directory ? `Preserved result and ${result.copiedImages.length} generated image(s).` : 'No machine result was available to preserve.')
  } catch {
    console.error('Could not preserve the factory result artifact.')
    process.exit(1)
  }
}
