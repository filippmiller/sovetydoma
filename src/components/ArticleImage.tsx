'use client'

import { useState } from 'react'

interface Props {
  src: string
  alt: string
  emoji: string
  /** font-size for the emoji fallback */
  fallbackSize?: string
}

/**
 * Renders an article image, but transparently falls back to the category
 * emoji if the file 404s or fails to load. This keeps cards/heroes looking
 * intentional while real photos are still being added.
 */
export default function ArticleImage({ src, alt, emoji, fallbackSize = '3.5rem' }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span aria-hidden="true" style={{ fontSize: fallbackSize }}>{emoji}</span>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
        // If the image 404s before onError swaps to the emoji, never let the
        // browser render the alt text at the hero's large inherited font size.
        fontSize: 0, color: 'transparent',
      }}
    />
  )
}
