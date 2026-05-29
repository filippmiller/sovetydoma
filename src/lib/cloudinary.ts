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
