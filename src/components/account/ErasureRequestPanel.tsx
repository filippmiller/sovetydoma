'use client'

import { useEffect, useState } from 'react'
import {
  cancelErasure,
  getErasureStatus,
  requestErasure,
  type ErasureRequestState,
} from '@/lib/privacy/privacy-worker-client'

/**
 * Self-service erasure UI (152-FZ compliance, canon §1.2). Lives in
 * moy-kabinet's "Приватность" tab. Two-phase: requesting schedules
 * anonymization after a 30-day grace period (workers/photo-upload/src/erasure.ts),
 * which the user can cancel any time before it runs.
 */
export default function ErasureRequestPanel() {
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<ErasureRequestState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getErasureStatus().then((result) => {
      if (cancelled) return
      if (result.ok) setPending(result.request)
      else setError('Не удалось загрузить статус запроса на удаление.')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const handleRequest = async () => {
    setBusy(true)
    setError('')
    const result = await requestErasure()
    setBusy(false)
    if (!result.ok) {
      setError('Не удалось создать запрос на удаление. Попробуйте позже или напишите через форму контактов.')
      return
    }
    setPending(result.request)
    setConfirming(false)
  }

  const handleCancel = async () => {
    setBusy(true)
    setError('')
    const result = await cancelErasure()
    setBusy(false)
    if (!result.ok) {
      setError('Не удалось отменить запрос. Попробуйте позже.')
      return
    }
    setPending(null)
  }

  if (loading) {
    return <p style={{ color: '#888' }}>Загрузка…</p>
  }

  return (
    <section aria-label="Приватность и удаление аккаунта" style={{ maxWidth: '620px' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.75rem', color: '#1a1a1a' }}>
        Удаление аккаунта
      </h2>
      <p style={{ color: '#666', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1rem' }}>
        Вы можете запросить обезличивание своих данных (имя, фото, текст комментариев, сохранённые статьи).
        У вас есть 30 дней на то, чтобы отменить запрос, если вы передумаете. По истечении срока данные
        обезличиваются автоматически. Обратите внимание: сам вход в аккаунт (email и пароль) при этом
        не удаляется — это отдельная функция, которая пока не реализована.
      </p>

      {error && <p style={{ color: '#c0392b', fontSize: '0.9rem', marginBottom: '1rem' }} role="alert">{error}</p>}

      {pending ? (
        <div style={{ background: '#fef3e2', border: '1px solid #f0d9b5', borderRadius: '8px', padding: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', color: '#7a4a12', fontWeight: 700 }}>
            Запрос на удаление отправлен
          </p>
          <p style={{ margin: '0 0 1rem', color: '#7a4a12', fontSize: '0.9rem' }}>
            Данные будут обезличены {formatDate(pending.gracePeriodEndsAt)}.
          </p>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            style={secondaryButtonStyle}
          >
            {busy ? 'Отменяем…' : 'Отменить запрос'}
          </button>
        </div>
      ) : confirming ? (
        <div style={{ background: '#fdecea', border: '1px solid #f3c6c0', borderRadius: '8px', padding: '1rem' }}>
          <p style={{ margin: '0 0 1rem', color: '#8a2a1f', fontWeight: 700 }}>
            Вы уверены? Через 30 дней имя, фото и комментарии будут обезличены без возможности восстановления.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button type="button" onClick={handleRequest} disabled={busy} style={dangerButtonStyle}>
              {busy ? 'Отправляем…' : 'Да, удалить'}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} style={secondaryButtonStyle}>
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} style={dangerButtonStyle}>
          Запросить удаление аккаунта
        </button>
      )}
    </section>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const dangerButtonStyle: React.CSSProperties = {
  background: '#c0392b', color: '#fff', border: 'none', borderRadius: '7px',
  padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
}
const secondaryButtonStyle: React.CSSProperties = {
  background: '#fff', color: '#444', border: '1px solid #d8d0c8', borderRadius: '7px',
  padding: '0.6rem 1.1rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
}
