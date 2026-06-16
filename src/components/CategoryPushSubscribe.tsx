'use client'

import { useState, useCallback, useEffect } from 'react'

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
  category: string
}

export default function CategoryPushSubscribe({ category }: Props) {
  const supported = typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator
  const [subscribed, setSubscribed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(`push_subscribed_${category}`) === '1'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!supported) return
    let cancelled = false
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => {
        if (cancelled) return
        if (!sub && subscribed) {
          setSubscribed(false)
          localStorage.removeItem(`push_subscribed_${category}`)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [category, supported, subscribed])

  const handleSubscribe = useCallback(async () => {
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
        body: JSON.stringify({ endpoint, p256dh, auth: authBase64, category }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'subscribe_failed')
      }

      localStorage.setItem(`push_subscribed_${category}`, '1')
      setSubscribed(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'subscribe_failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [category])

  const handleUnsubscribe = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (!('serviceWorker' in navigator)) throw new Error('service_worker_not_supported')
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        const endpoint = subscription.endpoint
        const apiUrl = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || 'https://sovetydoma-subscriptions.filippmiller.workers.dev'
        await fetch(`${apiUrl}/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {})
      }
      localStorage.removeItem(`push_subscribed_${category}`)
      setSubscribed(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unsubscribe_failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [category])

  if (!supported) return null

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {subscribed ? (
        <button
          onClick={handleUnsubscribe}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid #ddd',
            background: '#fff',
            color: '#555',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = ACCENT }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#ddd' }}
        >
          <span>🔕</span>
          <span>Отключить уведомления</span>
        </button>
      ) : (
        <button
          onClick={handleSubscribe}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            border: `1px solid ${ACCENT}`,
            background: '#fff',
            color: ACCENT,
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#fff5f5' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
        >
          <span>🔔</span>
          <span>Уведомлять о новых статьях</span>
        </button>
      )}
      {error && (
        <span style={{ fontSize: '0.75rem', color: ACCENT }}>
          {error === 'notification_permission_denied' ? 'Разрешение на уведомления отклонено' : 'Ошибка'}
        </span>
      )}
    </div>
  )
}
