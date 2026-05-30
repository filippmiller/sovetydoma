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
  // Seeded placeholders ("/images/*.jpg", "placeholder") point at files that
  // don't exist yet (there is no public/images dir). Render them as "no image"
  // so cards fall back to the gradient + emoji instead of a broken <img> whose
  // alt text (the article title) renders huge and overflows the hero.
  // Real images added later should use an absolute http(s) URL or a bare
  // Cloudinary public id, both of which still resolve below.
  if (v.includes('placeholder') || v.startsWith('/images/')) return null
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/')) return v
  return cloudinaryUrl(v, { ...opts, format: 'auto', quality: 'auto' as unknown as number })
}
