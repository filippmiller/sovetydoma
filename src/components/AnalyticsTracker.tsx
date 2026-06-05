'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const ANALYTICS_WORKER = (
  process.env.NEXT_PUBLIC_ANALYTICS_WORKER_URL
  || process.env.NEXT_PUBLIC_VIEW_WORKER_URL
  || process.env.NEXT_PUBLIC_CONTACT_WORKER_URL
  || process.env.NEXT_PUBLIC_PHOTO_WORKER_URL
  || ''
).replace(/\/+$/, '')

const CATEGORY_SLUGS = new Set([
  'kulinaria',
  'dom-i-uborka',
  'dacha-i-ogorod',
  'layfkhaki',
  'ekonomiya',
  'rybalka',
  'zdorovie-i-bezopasnost',
  'semya-i-deti',
  'krasota-i-uhod',
  'otdyh-i-puteshestviya',
  'pokupki-i-tehnika',
])

type ActivePageView = {
  id: string
  path: string
  startedAt: number
  maxScrollDepth: number
}

function getOrCreateStorageId(storage: Storage, key: string): string {
  const existing = storage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  storage.setItem(key, id)
  return id
}

function getSignals() {
  return {
    language: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    webdriver: navigator.webdriver === true,
  }
}

function articleMetaFromPath(path: string): { category: string; article_slug: string } {
  const parts = path.split('/').filter(Boolean)
  if (parts.length >= 2 && CATEGORY_SLUGS.has(parts[0])) {
    return { category: parts[0], article_slug: parts[1] }
  }
  if (parts.length === 1 && CATEGORY_SLUGS.has(parts[0])) {
    return { category: parts[0], article_slug: '' }
  }
  return { category: '', article_slug: '' }
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`.slice(0, 500)
}

export default function AnalyticsTracker() {
  const pathname = usePathname()
  const activeRef = useRef<ActivePageView | null>(null)
  const sequenceRef = useRef(0)

  useEffect(() => {
    if (!ANALYTICS_WORKER) return
    if (pathname?.startsWith('/admin')) return

    let visitorId = ''
    let sessionId = ''
    try {
      visitorId = getOrCreateStorageId(window.localStorage, 'sovetydoma_visitor_id')
      sessionId = getOrCreateStorageId(window.sessionStorage, 'sovetydoma_session_id')
    } catch {
      return
    }

    function send(eventName: 'page_view_start' | 'page_view_end', pageView: ActivePageView) {
      const meta = articleMetaFromPath(pageView.path)
      const duration = Math.max(0, Math.round((Date.now() - pageView.startedAt) / 1000))
      const payload = {
        event_name: eventName,
        session_id: sessionId,
        pageview_id: pageView.id,
        visitor_id: visitorId,
        path: pageView.path,
        title: document.title,
        referrer: document.referrer,
        category: meta.category,
        article_slug: meta.article_slug,
        duration_seconds: eventName === 'page_view_end' ? duration : 0,
        sequence_index: sequenceRef.current,
        scroll_depth: pageView.maxScrollDepth,
        signals: getSignals(),
      }

      const body = JSON.stringify(payload)
      if (eventName === 'page_view_end' && navigator.sendBeacon) {
        navigator.sendBeacon(`${ANALYTICS_WORKER}/analytics/event`, new Blob([body], { type: 'application/json' }))
        return
      }

      fetch(`${ANALYTICS_WORKER}/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }

    function endActive() {
      const active = activeRef.current
      if (!active) return
      send('page_view_end', active)
      activeRef.current = null
    }

    endActive()
    sequenceRef.current += 1
    const pageView: ActivePageView = {
      id: crypto.randomUUID(),
      path: currentPath(),
      startedAt: Date.now(),
      maxScrollDepth: 0,
    }
    activeRef.current = pageView
    send('page_view_start', pageView)

    function updateScrollDepth() {
      const active = activeRef.current
      if (!active) return
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100))
      active.maxScrollDepth = Math.max(active.maxScrollDepth, depth)
    }

    function onPageHide() {
      updateScrollDepth()
      endActive()
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') onPageHide()
    }

    window.addEventListener('scroll', updateScrollDepth, { passive: true })
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      updateScrollDepth()
      endActive()
      window.removeEventListener('scroll', updateScrollDepth)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [pathname])

  return null
}
