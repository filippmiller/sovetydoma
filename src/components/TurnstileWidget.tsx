'use client'

import { useEffect, useRef, useState } from 'react'

const SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '').trim()

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

type Props = {
  onToken: (token: string) => void
}

export function turnstileConfigured(): boolean {
  return Boolean(SITE_KEY)
}

export default function TurnstileWidget({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    if (!SITE_KEY) return

    const markReady = () => {
      queueMicrotask(() => setScriptReady(true))
    }

    const existing = document.getElementById('cf-turnstile-script')
    if (existing) {
      if (window.turnstile) markReady()
      else existing.addEventListener('load', markReady, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'cf-turnstile-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = markReady
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!SITE_KEY || !scriptReady || !containerRef.current || !window.turnstile) return

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token) => onToken(token),
      'expired-callback': () => onToken(''),
      'error-callback': () => onToken(''),
    })

    return () => {
      window.turnstile?.remove(widgetId)
    }
  }, [scriptReady, onToken])

  if (!SITE_KEY) return null

  return <div ref={containerRef} aria-label="Проверка безопасности" />
}