const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

export function cloudinaryUrl(publicId: string, options: {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'jpg' | 'auto'
} = {}): string {
  if (!CLOUD_NAME) return `/images/${publicId}.jpg`

  const transforms = [
    options.width ? `w_${options.width}` : '',
    options.height ? `h_${options.height}` : '',
    `q_${options.quality || 'auto'}`,
    `f_${options.format || 'auto'}`,
    'c_fill',
  ].filter(Boolean).join(',')

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms}/${publicId}`
}

/**
 * Resolve an article's `image` frontmatter value to a usable <img> src.
 * - empty / missing            → null (caller shows the emoji fallback)
 * - absolute URL or /public path → used as-is
 * - bare id                    → treated as a Cloudinary public id
 */
export function resolveArticleImage(
  image: string | undefined,
  opts: { width?: number; height?: number } = {},
): string | null {
  const v = (image || '').trim()
  if (!v) return null
  // Generic seeded placeholder → no image (cards fall back to gradient + emoji).
  // Real per-article files under /images/<slug>.jpg ARE served; if the file is
  // still missing, <ArticleImage> transparently 404-falls-back to the emoji,
  // so this is safe even before every image has been fetched.
  if (v.includes('placeholder')) return null
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/')) return v
  return cloudinaryUrl(v, { ...opts, format: 'auto', quality: 'auto' as unknown as number })
}

export function resolveArticlePreviewImage(
  image: string | undefined,
  slug: string,
  opts: { width?: number; height?: number } = {},
): string | null {
  const v = (image || '').trim()
  const width = opts.width || 240
  const height = opts.height || 240

  if (!v || v.includes('placeholder')) return `/images/previews/${slug}.jpg`
  if (v.startsWith('/images/')) {
    const file = v.split('/').pop()
    return file ? `/images/previews/${file}` : `/images/previews/${slug}.jpg`
  }
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/')) return v
  return cloudinaryUrl(v, { width, height, format: 'auto', quality: 70 })
}
