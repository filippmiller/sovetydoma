#!/usr/bin/env node
import path from 'node:path'
import {
  buildImageAudit,
  readArticleFiles,
  readImageFiles,
} from './image-audit-utils.mjs'

const args = new Set(process.argv.slice(2))
const root = process.cwd()
const articlesDir = path.join(root, 'src/content/articles')
const imagesDir = path.join(root, 'public/images')
const previewsDir = path.join(imagesDir, 'previews')

const audit = buildImageAudit({
  articles: readArticleFiles(articlesDir),
  images: readImageFiles(imagesDir),
  previews: readImageFiles(previewsDir),
})

if (args.has('--json')) {
  console.log(JSON.stringify(audit, null, 2))
} else {
  console.log(`Articles: ${audit.articleCount}`)
  console.log(`Images: ${audit.imageCount}`)
  console.log(`Unique image files: ${audit.uniqueImageCount}`)
  console.log(`Exact duplicate groups: ${audit.exactDuplicateGroups.length}`)
  for (const group of audit.exactDuplicateGroups) {
    console.log(`- ${group.length}: ${group.join(', ')}`)
  }
  console.log(`Missing images: ${audit.missingImages.length}`)
  if (audit.missingImages.length) console.log(`- ${audit.missingImages.join(', ')}`)
  console.log(`Missing previews: ${audit.missingPreviews.length}`)
  if (audit.missingPreviews.length) console.log(`- ${audit.missingPreviews.join(', ')}`)
  console.log(`Orphan images: ${audit.orphanImages.length}`)
  if (audit.orphanImages.length) console.log(`- ${audit.orphanImages.join(', ')}`)
  console.log(`Image frontmatter drifts: ${audit.imageFrontmatterDrifts.length}`)
  if (audit.imageFrontmatterDrifts.length) console.log(`- ${audit.imageFrontmatterDrifts.join(', ')}`)
}

if (args.has('--fail-on-duplicates') && audit.exactDuplicateGroups.length > 0) {
  process.exit(1)
}
if (args.has('--fail-on-drifts') && audit.imageFrontmatterDrifts.length > 0) {
  process.exit(1)
}
if (args.has('--fail-on-missing-previews') && audit.missingPreviews.length > 0) {
  process.exit(1)
}
