'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import SubscriptionPanel from '@/components/subscriptions/SubscriptionPanel'
import { CATEGORIES } from '@/lib/categories'
import { clearManageTokenFromUrl, readManageToken, saveManageToken } from '@/lib/subscriptions/manage-token'

function firstValue(value: string | null) {
  return value || undefined
}

export default function PodpiskiClient() {
  const searchParams = useSearchParams()
  const categorySlug = firstValue(searchParams.get('category'))
  const confirmed = searchParams.get('confirmed') === '1'
  const unsubscribeToken = firstValue(searchParams.get('unsubscribe_token'))
  const urlManageToken = firstValue(searchParams.get('manage_token'))
  const manageToken = useMemo(() => {
    if (urlManageToken) {
      saveManageToken(urlManageToken)
      return urlManageToken
    }
    return readManageToken()
  }, [urlManageToken])

  useEffect(() => {
    if (urlManageToken) clearManageTokenFromUrl()
  }, [urlManageToken])
  const apiBase = (process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '').trim().replace(/\/+$/, '')
  const selectedCategorySlug = categorySlug && CATEGORIES[categorySlug] ? categorySlug : undefined
  const selectedCategoryName = selectedCategorySlug ? CATEGORIES[selectedCategorySlug].name : 'категорию'

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8a8378', marginBottom: '0.45rem' }}>
          Подписки
        </div>
        <h1 style={{ fontSize: '1.9rem', lineHeight: 1.25, fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          Подписка по категориям, подтверждения и управление каналами
        </h1>
        <p style={{ margin: '0.55rem 0 0', color: '#666', fontSize: '0.96rem', lineHeight: 1.65, maxWidth: '760px' }}>
          Выберите категорию, способ доставки и частоту. Подписки всегда создаются только для выбранной категории.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1.25rem',
      }}>
        <InfoCard title="Подтверждение" body="После перехода из письма или бота статус подтверждения появится здесь." tone="success" active={confirmed} />
        <InfoCard title="Отписка" body="Одноразовая ссылка или ручное управление доступно на этой странице." tone="warning" active={Boolean(unsubscribeToken)} />
        <InfoCard title="Управление" body="Смените категории, частоту и каналы ниже без прямой записи в базу из браузера." tone="neutral" active={Boolean(manageToken)} />
      </div>

      {confirmed && (
        <div style={{
          border: '1px solid #a9dfbf',
          background: '#e9f7ef',
          color: '#1e7b44',
          borderRadius: 8,
          padding: '0.85rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.88rem',
          lineHeight: 1.55,
        }}>
          Подписка подтверждена. Если вы выбирали несколько каналов, каждый из них подтверждается отдельно.
        </div>
      )}

      {unsubscribeToken && (
        <div style={{
          border: '1px solid #f0d89a',
          background: '#fff5dd',
          color: '#8f5f00',
          borderRadius: 8,
          padding: '0.9rem 1rem',
          marginBottom: '1rem',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Отписка по одноразовой ссылке</div>
          <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55 }}>
            Ссылка готова к использованию. Если сервис подписки подключён, отправьте запрос на удаление адреса из списка.
          </p>
          {apiBase ? (
            <form
              method="post"
              action={`${apiBase}/subscriptions/unsubscribe`}
              style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.85rem' }}
            >
              <input type="hidden" name="token" value={unsubscribeToken} />
              <button
                type="submit"
                style={{
                  background: '#c0392b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.65rem 1rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Отписаться
              </button>
            </form>
          ) : (
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
              Сервис подписки не настроен: задайте <code>NEXT_PUBLIC_SUBSCRIPTIONS_API_URL</code>.
            </div>
          )}
        </div>
      )}

      {manageToken && (
        <div style={{
          border: '1px solid #e8e4df',
          background: '#fff',
          color: '#2c2c2c',
          borderRadius: 8,
          padding: '0.9rem 1rem',
          marginBottom: '1rem',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Управление подпиской</div>
          <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55 }}>
            Откройте панель ниже, чтобы сменить категории и каналы для текущей подписки.
          </p>
          <div style={{ marginTop: '0.7rem' }}>
            <Link
              href="#subscription-panel"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #c0392b',
                borderRadius: 999,
                padding: '0.42rem 0.75rem',
                color: '#c0392b',
                textDecoration: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              Перейти к форме
            </Link>
          </div>
        </div>
      )}

      <SubscriptionPanel
        key={manageToken ? 'manage-subscription-panel' : 'new-subscription-panel'}
        initialCategorySlug={selectedCategorySlug}
        manageToken={manageToken}
      />

      <div style={{ marginTop: '1.25rem', color: '#666', fontSize: '0.84rem', lineHeight: 1.6 }}>
        Если вы пришли из статьи или раздела, выберите категорию сверху страницы или используйте кнопку рядом с публикацией.
        {selectedCategorySlug && ` Сейчас предвыбрана категория «${selectedCategoryName}».`}
      </div>
    </div>
  )
}

function InfoCard({
  title,
  body,
  tone,
  active,
}: {
  title: string
  body: string
  tone: 'success' | 'warning' | 'neutral'
  active: boolean
}) {
  const palette = tone === 'success'
    ? { bg: active ? '#e9f7ef' : '#fafafa', border: active ? '#a9dfbf' : '#e8e4df', accent: '#1e7b44' }
    : tone === 'warning'
      ? { bg: active ? '#fff5dd' : '#fafafa', border: active ? '#f0d89a' : '#e8e4df', accent: '#8f5f00' }
      : { bg: active ? '#f7f3ef' : '#fafafa', border: active ? '#d9cec1' : '#e8e4df', accent: '#666' }

  return (
    <div style={{
      border: `1px solid ${palette.border}`,
      background: palette.bg,
      borderRadius: 8,
      padding: '0.85rem 0.95rem',
    }}>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: palette.accent, marginBottom: '0.35rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.86rem', lineHeight: 1.55, color: '#2c2c2c' }}>
        {body}
      </div>
    </div>
  )
}