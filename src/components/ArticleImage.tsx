'use client'

import { useState } from 'react'

interface Props {
  src: string
  alt: string
  emoji: string
  /** font-size for the emoji fallback */
  fallbackSize?: string
  loading?: 'eager' | 'lazy'
}

// Matches a .jpg/.jpeg extension that is either at the end of the string or
// followed by a query string (preview URLs carry a ?v=... cache-buster), and
// rewrites just the extension to .webp while preserving the query.
const webpFor = (src: string) =>
  /\.jpe?g(\?|$)/i.test(src) ? src.replace(/\.jpe?g(\?|$)/i, '.webp$1') : null

/**
 * Renders an article image, but transparently falls back to the category
 * emoji if the file 404s or fails to load. This keeps cards/heroes looking
 * intentional while real photos are still being added.
 *
 * Images are served as WebP (build-time generated, ~70-85% smaller than the
 * source JPEG). We avoid <picture> because when a matched <source> 404s the
 * browser will NOT fall back to <img> — instead we chain onError:
 * webp → original jpeg → emoji. This keeps the emoji fallback working and gives
 * the rare non-WebP browser the JPEG.
 */
export default function ArticleImage({ src, alt, emoji, fallbackSize = '3.5rem', loading = 'lazy' }: Props) {
  const webp = webpFor(src)
  // Stages: try webp first (when available), then the original src, then emoji.
  const [stage, setStage] = useState<'webp' | 'orig' | 'failed'>(webp ? 'webp' : 'orig')

  const onError = () => setStage((s) => (s === 'webp' ? 'orig' : 'failed'))
  const failed = stage === 'failed'
  const currentSrc = stage === 'webp' && webp ? webp : src

  if (failed) {
    return (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: fallbackSize,
        }}
      >
        {emoji}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={currentSrc}
      src={currentSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={onError}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        // If the image 404s before onError swaps to the emoji, never let the
        // browser render the alt text at the hero's large inherited font size.
        fontSize: 0, color: 'transparent',
      }}
    />
  )
}
