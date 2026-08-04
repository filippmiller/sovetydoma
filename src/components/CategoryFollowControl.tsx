'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

const ACCENT = '#c0392b'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

interface Props {
  categorySlug: string
  categoryName: string
}

/**
 * Single "Следить за рубрикой" control for the category header. Used to be
 * two near-identical buttons (CategorySubscriptionCta + CategoryPushSubscribe)
 * doing the same job — push is the immediate, one-click action; the email
 * digest link only appears once the user has already engaged, instead of
 * competing for space on first paint.
 */
export default function CategoryFollowControl({ categorySlug, categoryName }: Props) {
  // Browser-only capabilities and saved state must be loaded after hydration;
  // otherwise a returning visitor can receive different server/client markup.
  const [supported, setSupported] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSupported('PushManager' in window && 'serviceWorker' in navigator)
    setSubscribed(localStorage.getItem(`push_subscribed_${categorySlug}`) === '1')
  }, [categorySlug])

  useEffect(() => {
    if (typeof window === 'undefined' || !supported) return
    let cancelled = false
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled) return
        if (!sub && subscribed) {
          setSubscribed(false)
          localStorage.removeItem(`push_subscribed_${categorySlug}`)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [categorySlug, supported, subscribed])

  const subscribe = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!('serviceWorker' in navigator)) throw new Error('service_worker_not_supported')
      if (Notification.permission === 'denied') throw new Error('notification_permission_denied')
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') throw new Error('notification_permission_denied')
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) throw new Error('vapid_public_key_not_configured')
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        })
      }

      const endpoint = subscription.endpoint
      const key = subscription.getKey('p256dh')
      const auth = subscription.getKey('auth')
      if (!endpoint || !key || !auth) throw new Error('invalid_push_subscription')

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)))
      const authBase64 = btoa(String.fromCharCode(...new Uint8Array(auth)))

      const apiUrl = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || 'https://sovetydoma-subscriptions.filippmiller.workers.dev'
      const res = await fetch(`${apiUrl}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, p256dh, auth: authBase64, category: categorySlug }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'subscribe_failed')
      }

      localStorage.setItem(`push_subscribed_${categorySlug}`, '1')
      setSubscribed(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'subscribe_failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [categorySlug])

  const unsubscribe = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
          const apiUrl = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || 'https://sovetydoma-subscriptions.filippmiller.workers.dev'
          await fetch(`${apiUrl}/push/unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          }).catch(() => {})
        }
      }
      localStorage.removeItem(`push_subscribed_${categorySlug}`)
      setSubscribed(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unsubscribe_failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [categorySlug])

  const handlePrimaryClick = useCallback(() => {
    setExpanded(true)
    if (supported && !subscribed) subscribe()
  }, [supported, subscribed, subscribe])

  const buttonBaseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.45rem 0.78rem',
    borderRadius: 999,
    border: `1px solid ${ACCENT}`,
    background: '#fff',
    color: ACCENT,
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    whiteSpace: 'nowrap' as const,
  }

  if (!expanded && !subscribed) {
    return (
      <button onClick={handlePrimaryClick} disabled={loading} style={buttonBaseStyle} aria-label={`Следить за рубрикой ${categoryName}`}>
        <span aria-hidden="true">🔔</span>
        <span>Следить за рубрикой</span>
      </button>
    )
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {supported ? (
        subscribed ? (
          <button onClick={unsubscribe} disabled={loading} style={{ ...buttonBaseStyle, background: '#fff', color: '#555', borderColor: '#ddd' }}>
            <span aria-hidden="true">🔕</span>
            <span>Отключить уведомления</span>
          </button>
        ) : (
          <button onClick={subscribe} disabled={loading} style={buttonBaseStyle}>
            <span aria-hidden="true">🔔</span>
            <span>{loading ? 'Подключаем…' : 'Включить уведомления'}</span>
          </button>
        )
      ) : null}
      <Link
        href={`/podpiski/?category=${encodeURIComponent(categorySlug)}#subscription-panel`}
        style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'underline', whiteSpace: 'nowrap' }}
      >
        Email-дайджест →
      </Link>
      {error && (
        <span style={{ fontSize: '0.75rem', color: ACCENT }}>
          {error === 'notification_permission_denied' ? 'Разрешение на уведомления отклонено' : 'Ошибка, попробуйте ещё раз'}
        </span>
      )}
    </div>
  )
}
