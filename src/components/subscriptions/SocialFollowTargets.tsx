'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type Tone = 'light' | 'dark'

type SocialTarget = {
  platform: string
  display_name: string
  url: string
}

type Props = {
  compact?: boolean
  tone?: Tone
}

const SUBSCRIPTIONS_API_BASE = (process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '').trim().replace(/\/+$/, '')

const PLATFORM_LABELS: Record<string, string> = {
  vk: 'VK',
  ok: 'OK',
  facebook: 'Facebook',
}

export default function SocialFollowTargets({ compact = false, tone = 'light' }: Props) {
  const pathname = usePathname()
  const isDark = tone === 'dark'
  const border = isDark ? '#555' : '#e8e4df'
  const background = isDark ? '#303030' : '#fff'
  const color = isDark ? '#f0ede8' : '#1a1a1a'
  const [targets, setTargets] = useState<SocialTarget[]>([])

  useEffect(() => {
    if (!SUBSCRIPTIONS_API_BASE) return
    let cancelled = false
    fetch(`${SUBSCRIPTIONS_API_BASE}/social/targets`)
      .then((res) => res.json().catch(() => null) as Promise<{ targets?: SocialTarget[] } | null>)
      .then((data) => {
        if (!cancelled && Array.isArray(data?.targets)) setTargets(data.targets)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const track = useCallback((platform: string, action: 'cta_view' | 'cta_click') => {
    if (!SUBSCRIPTIONS_API_BASE) return

    const payload = JSON.stringify({
      platform,
      action,
      sourcePath: pathname || '/',
    })

    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${SUBSCRIPTIONS_API_BASE}/social/track`, new Blob([payload], { type: 'application/json' }))
      return
    }

    void fetch(`${SUBSCRIPTIONS_API_BASE}/social/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined)
  }, [pathname])

  useEffect(() => {
    for (const target of targets) {
      track(target.platform, 'cta_view')
    }
  }, [pathname, targets, track])

  if (targets.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: compact ? '0.78rem' : '0.82rem', color: isDark ? '#c0bdb8' : '#666', lineHeight: 1.45 }}>
        Социальные страницы появятся здесь после публикации.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
      {targets.map((target) => (
        <Link
          key={target.platform}
          href={target.url}
          target="_blank"
          rel="noreferrer"
          onClick={() => track(target.platform, 'cta_click')}
          style={socialTargetStyle(border, background, color, compact)}
        >
          {PLATFORM_LABELS[target.platform] || target.display_name}
        </Link>
      ))}
    </div>
  )
}

function socialTargetStyle(border: string, background: string, color: string, compact: boolean) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${border}`,
    background,
    color,
    borderRadius: 999,
    padding: compact ? '0.42rem 0.75rem' : '0.5rem 0.85rem',
    fontSize: compact ? '0.8rem' : '0.84rem',
    fontWeight: 700,
    textDecoration: 'none',
  } as const
}