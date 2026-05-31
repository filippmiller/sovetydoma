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

const audit = buildImageAudit({
  articles: readArticleFiles(articlesDir),
  images: readImageFiles(imagesDir),
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
  console.log(`Orphan images: ${audit.orphanImages.length}`)
  if (audit.orphanImages.length) console.log(`- ${audit.orphanImages.join(', ')}`)
}

if (args.has('--fail-on-duplicates') && audit.exactDuplicateGroups.length > 0) {
  process.exit(1)
}
