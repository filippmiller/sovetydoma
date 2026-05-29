'use client'

import { useEffect, useState } from 'react'

interface Props {
  show?: boolean
}

export default function ReadingProgress({ show = false }: Props) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!show) return

    function onScroll() {
      const scrollY = window.scrollY
      const total = document.body.scrollHeight - window.innerHeight
      if (total <= 0) {
        setProgress(0)
        return
      }
      setProgress(Math.min(1, scrollY / total))
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [show])

  if (!show) return null

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Прогресс чтения"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${progress * 100}%`,
        height: '3px',
        background: '#c0392b',
        zIndex: 9999,
        transition: 'width 0.1s linear',
        pointerEvents: 'none',
      }}
    />
  )
}
