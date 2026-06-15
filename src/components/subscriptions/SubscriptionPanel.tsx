'use client'

import type { CSSProperties, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import SocialFollowTargets from '@/components/subscriptions/SocialFollowTargets'
import TurnstileWidget, { turnstileConfigured } from '@/components/TurnstileWidget'
import { saveManageToken } from '@/lib/subscriptions/manage-token'
import { validateSubscriptionRequest } from '@/lib/subscriptions/validation.mjs'
import { bannerColors } from './theme'
import type { ChannelResult } from './theme'
import ChannelPicker from './ChannelPicker'
import ChannelStatusBanner from './ChannelStatusBanner'

type Tone = 'light' | 'dark'
type SubmitStatus = 'idle' | 'success' | 'warning' | 'error'

type SubmitResponse = {
  recipientId?: string
  manageToken?: string
  message?: string
  error?: string
  errors?: Record<string, string | undefined>
  channels?: Record<string, ChannelResult>
  subscription?: {
    recipient?: { frequency?: string }
    contacts?: Array<{ channel: string; status: string; contact: string }>
    categories?: Array<{ category_slug: string; status: string }>
  }
}

type Props = {
  initialCategorySlug?: string
  manageToken?: string
  compact?: boolean
  showHeading?: boolean
  tone?: Tone
  className?: string
}

const FREQUENCIES = [
  { key: 'daily_one', label: '1 статья в день' },
  { key: 'daily_digest_3', label: '3 статьи в день' },
  { key: 'weekly_digest_3', label: '3 статьи в неделю' },
  { key: 'weekly_digest_7', label: 'Еженедельная подборка' },
] as const

const SUBSCRIPTIONS_API_BASE = (process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL || '').trim().replace(/\/+$/, '')

function getPathCategorySlug(pathname: string | null) {
  if (!pathname) return null
  const [firstSegment] = pathname.split('/').filter(Boolean)
  return firstSegment && CATEGORIES[firstSegment] ? firstSegment : null
}

export default function SubscriptionPanel({
  initialCategorySlug,
  manageToken,
  compact = false,
  showHeading = true,
  tone = 'light',
  className,
}: Props) {
  const pathname = usePathname()
  const resolvedCategorySlug = useMemo(
    () => (initialCategorySlug && CATEGORIES[initialCategorySlug] ? initialCategorySlug : getPathCategorySlug(pathname)),
    [initialCategorySlug, pathname],
  )

  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => (resolvedCategorySlug ? [resolvedCategorySlug] : []))
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email'])
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]['key']>('weekly_digest_3')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingManage, setLoadingManage] = useState(() => Boolean(manageToken && SUBSCRIPTIONS_API_BASE))
  const [status, setStatus] = useState<{ kind: SubmitStatus; text: string | null }>({ kind: 'idle', text: null })
  const [response, setResponse] = useState<SubmitResponse | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')

  const colors = bannerColors(tone, status.kind)
  const isDark = tone === 'dark'
  const cardRadius = compact ? 6 : 8
  const isManageMode = Boolean(manageToken)
  const requiresTurnstile = turnstileConfigured() && !isManageMode

  const allCategories = Object.values(CATEGORIES)

  useEffect(() => {
    if (!manageToken || !SUBSCRIPTIONS_API_BASE) return
    let cancelled = false
    fetch(`${SUBSCRIPTIONS_API_BASE}/subscriptions/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: manageToken }),
    })
      .then((res) => res.json().catch(() => null) as Promise<SubmitResponse | null>)
      .then((data) => {
        if (cancelled || !data?.subscription) return
        const activeCategories = data.subscription.categories
          ?.filter((item) => item.status === 'active' && CATEGORIES[item.category_slug])
          .map((item) => item.category_slug) || []
        const activeChannels = data.subscription.contacts
          ?.filter((item) => item.status !== 'unsubscribed')
          .map((item) => item.channel) || []
        if (activeCategories.length > 0) setSelectedCategories(activeCategories)
        if (activeChannels.length > 0) setSelectedChannels(activeChannels)
        const nextFrequency = data.subscription.recipient?.frequency
        if (FREQUENCIES.some((item) => item.key === nextFrequency)) {
          setFrequency(nextFrequency as (typeof FREQUENCIES)[number]['key'])
        }
        setResponse(data)
      })
      .catch(() => {
        if (!cancelled) setStatus({ kind: 'error', text: 'Не удалось загрузить текущие настройки подписки.' })
      })
      .finally(() => {
        if (!cancelled) setLoadingManage(false)
      })
    return () => {
      cancelled = true
    }
  }, [manageToken])

  function toggleCategory(slug: string) {
    setSelectedCategories((current) => {
      const hasCategory = current.includes(slug)
      if (hasCategory) {
        if (current.length === 1) return current
        return current.filter((item) => item !== slug)
      }
      return [...current, slug]
    })
  }

  function toggleChannel(channel: string) {
    setSelectedChannels((current) => (current.includes(channel)
      ? current.filter((item) => item !== channel)
      : [...current, channel]))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResponse(null)

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = phone.replace(/[^\d+]/g, '')

    if (!isManageMode) {
      const validation = validateSubscriptionRequest({
        categories: selectedCategories,
        channels: selectedChannels,
        frequency,
        contacts: { email: normalizedEmail, phone: normalizedPhone },
        consent,
        advertisingConsent: false,
        sourcePath: pathname || '/',
        turnstileToken,
      })
      if (!validation.valid) {
        const detail = Object.values(validation.errors).filter(Boolean).join('; ')
        setStatus({ kind: 'error', text: detail || 'Проверьте поля формы.' })
        return
      }
      if (requiresTurnstile && !turnstileToken) {
        setStatus({ kind: 'error', text: 'Подтвердите проверку безопасности перед отправкой.' })
        return
      }
    } else if (selectedCategories.length === 0) {
      setStatus({ kind: 'error', text: 'Выберите хотя бы одну категорию.' })
      return
    }

    if (!SUBSCRIPTIONS_API_BASE) {
      setStatus({
        kind: 'warning',
        text: 'Сервис подписки не настроен: задайте NEXT_PUBLIC_SUBSCRIPTIONS_API_URL и повторите отправку.',
      })
      return
    }

    setSubmitting(true)
    setStatus({ kind: 'idle', text: null })

    try {
      const res = await fetch(`${SUBSCRIPTIONS_API_BASE}${isManageMode ? '/subscriptions/manage' : '/subscriptions/start'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isManageMode ? {
          token: manageToken,
          categories: selectedCategories,
          frequency,
        } : {
          categories: selectedCategories,
          channels: selectedChannels,
          frequency,
          contacts: {
            email: normalizedEmail,
            phone: normalizedPhone,
          },
          consent: true,
          advertisingConsent: false,
          sourcePath: pathname || '/',
          turnstileToken: turnstileToken || undefined,
        }),
      })

      const data = (await res.json().catch(() => null)) as SubmitResponse | null
      if (!res.ok) {
        const detail = data?.error || Object.values(data?.errors || {}).filter(Boolean).join('; ')
        setStatus({
          kind: 'error',
          text: data?.message || detail || 'Не удалось отправить заявку. Попробуйте позже.',
        })
        return
      }

      setResponse(data)
      if (!isManageMode && data?.manageToken) {
        saveManageToken(String(data.manageToken))
      }
      setStatus({
        kind: 'success',
        text: data?.message || (isManageMode
          ? 'Настройки подписки сохранены.'
          : 'Заявка отправлена. Проверьте выбранные каналы и письмо с подтверждением. Ссылка управления сохранена в этом браузере.'),
      })
    } catch {
      setStatus({ kind: 'error', text: 'Сервис подписки временно недоступен.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      id="subscription-panel"
      className={className}
      style={{
        marginTop: compact ? '0' : '1rem',
        padding: compact ? '0' : '0.5rem 0 0',
      }}
    >
      {showHeading && (
        <div style={{ marginBottom: compact ? '0.8rem' : '1rem' }}>
          <div style={{
            fontSize: compact ? '0.75rem' : '0.8rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: colors.baseMuted,
            marginBottom: '0.35rem',
          }}>
            Подписки по категориям
          </div>
          <h2 style={{
            margin: 0,
            fontSize: compact ? '1rem' : '1.2rem',
            lineHeight: 1.3,
            color: colors.baseText,
          }}>
              {isManageMode ? 'Настройте категории и частоту' : 'Выберите категории и каналы доставки'}
          </h2>
          {!compact && (
            <p style={{
              margin: '0.35rem 0 0',
              color: colors.baseMuted,
              fontSize: '0.92rem',
              lineHeight: 1.55,
            }}>
              {isManageMode
                ? 'Выберите категории и частоту для текущей подписки.'
                : 'Подписка всегда привязана к категории. Можно выбрать несколько разделов и несколько способов доставки.'}
            </p>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          background: colors.baseBg,
          border: `1px solid ${colors.baseBorder}`,
          borderRadius: cardRadius,
          padding: compact ? '0.85rem' : '1rem',
          boxShadow: isDark ? 'none' : '0 1px 0 rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'grid', gap: compact ? '0.8rem' : '1rem' }}>
          <div>
            <div style={sectionLabelStyle(colors.baseMuted, compact)}>Категории</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {allCategories.map((category) => {
                const selected = selectedCategories.includes(category.slug)
                return (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => toggleCategory(category.slug)}
                    aria-pressed={selected}
                    style={{
                      border: `1px solid ${selected ? '#c0392b' : colors.chipBorder}`,
                      background: selected ? '#c0392b' : colors.chipBg,
                      color: selected ? '#fff' : colors.chipText,
                      borderRadius: 999,
                      padding: compact ? '0.4rem 0.7rem' : '0.48rem 0.82rem',
                      fontSize: compact ? '0.8rem' : '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.1,
                    }}
                  >
                    {category.name}
                  </button>
                )
              })}
            </div>
            {resolvedCategorySlug && (
              <p style={{ margin: '0.45rem 0 0', color: colors.baseMuted, fontSize: compact ? '0.76rem' : '0.8rem' }}>
                Текущая категория уже выбрана.
              </p>
            )}
          </div>

          {!isManageMode && (
          <div>
            <div style={sectionLabelStyle(colors.baseMuted, compact)}>Каналы</div>
            <ChannelPicker
              selectedChannels={selectedChannels}
              onToggle={toggleChannel}
              colors={colors}
              cardRadius={cardRadius}
              compact={compact}
              isDark={isDark}
            />
          </div>
          )}

          {!isManageMode && (
          <div>
            <div style={sectionLabelStyle(colors.baseMuted, compact)}>Соцсети</div>
            <SocialFollowTargets compact={compact} tone={tone} />
          </div>
          )}

          <div>
            <div style={sectionLabelStyle(colors.baseMuted, compact)}>Частота</div>
            <div
              role="radiogroup"
              aria-label="Частота уведомлений"
              style={{
              display: 'grid',
              gridTemplateColumns: compact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '0.45rem',
            }}>
              {FREQUENCIES.map((item) => {
                const selected = frequency === item.key
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFrequency(item.key)}
                    style={{
                      border: `1px solid ${selected ? '#c0392b' : colors.baseBorder}`,
                      background: selected ? '#c0392b' : colors.baseBg,
                      color: selected ? '#fff' : colors.baseText,
                      borderRadius: cardRadius,
                      padding: compact ? '0.6rem 0.7rem' : '0.7rem 0.8rem',
                      fontSize: compact ? '0.8rem' : '0.84rem',
                      fontWeight: 700,
                      textAlign: 'left',
                      cursor: 'pointer',
                      lineHeight: 1.25,
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          {!isManageMode && (
          <div>
            <div style={sectionLabelStyle(colors.baseMuted, compact)}>Контакты</div>
            <div style={{ display: 'grid', gap: '0.7rem' }}>
              {selectedChannels.includes('email') && (
                <label style={fieldLabelStyle(colors.baseText, compact)}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="reader@example.com"
                    style={fieldInputStyle(colors.fieldBg, colors.fieldBorder, colors.fieldText, cardRadius, compact)}
                  />
                </label>
              )}

              {(selectedChannels.includes('whatsapp') || selectedChannels.includes('sms')) && (
                <label style={fieldLabelStyle(colors.baseText, compact)}>
                  <span>Телефон</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+7 999 123-45-67"
                    inputMode="tel"
                    style={fieldInputStyle(colors.fieldBg, colors.fieldBorder, colors.fieldText, cardRadius, compact)}
                  />
                </label>
              )}

              {selectedChannels.includes('telegram') && (
                <div style={helperCardStyle(colors, compact)}>
                  После отправки откроется шаг подтверждения в Telegram.
                </div>
              )}

              {selectedChannels.includes('max') && (
                <div style={helperCardStyle(colors, compact)}>
                  После отправки откроется шаг подтверждения в MAX.
                </div>
              )}
            </div>
          </div>
          )}

          {!isManageMode && requiresTurnstile && (
          <div>
            <div style={sectionLabelStyle(colors.baseMuted, compact)}>Проверка</div>
            <TurnstileWidget onToken={setTurnstileToken} />
          </div>
          )}

          {!isManageMode && (
          <label style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start',
            color: colors.baseText,
            fontSize: compact ? '0.82rem' : '0.86rem',
            lineHeight: 1.45,
          }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              style={{ marginTop: '0.15rem', accentColor: '#c0392b', flexShrink: 0 }}
            />
            <span>
              Я согласен получать уведомления по выбранным категориям и понимаю, что каждый канал подтверждается отдельно.
            </span>
          </label>
          )}

          <button
            type="submit"
            disabled={submitting || loadingManage}
            style={{
              alignSelf: 'start',
              border: 'none',
              borderRadius: cardRadius,
              background: '#c0392b',
              color: '#fff',
              padding: compact ? '0.65rem 0.95rem' : '0.75rem 1rem',
              fontSize: compact ? '0.84rem' : '0.9rem',
              fontWeight: 700,
              cursor: submitting || loadingManage ? 'wait' : 'pointer',
              opacity: submitting || loadingManage ? 0.75 : 1,
            }}
          >
            {loadingManage ? 'Загрузка...' : submitting ? 'Отправка...' : (isManageMode ? 'Сохранить подписку' : 'Подписаться')}
          </button>

          {status.text && (
            <div
              style={{
                borderRadius: cardRadius,
                border: `1px solid ${colors.accent?.border || colors.baseBorder}`,
                background: colors.accent?.bg || colors.baseBg,
                color: colors.accent?.text || colors.baseText,
                padding: compact ? '0.65rem 0.75rem' : '0.8rem 0.9rem',
                fontSize: compact ? '0.8rem' : '0.86rem',
                lineHeight: 1.5,
              }}
            >
              {status.text}
            </div>
          )}

          {response?.channels && (
            <ChannelStatusBanner
              channels={response.channels}
              colors={colors}
              cardRadius={cardRadius}
              compact={compact}
              isDark={isDark}
            />
          )}
        </div>
      </form>
    </section>
  )
}

function sectionLabelStyle(color: string, compact: boolean): CSSProperties {
  return {
    fontSize: compact ? '0.72rem' : '0.78rem',
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color,
    marginBottom: '0.4rem',
  }
}

function fieldLabelStyle(textColor: string, compact: boolean): CSSProperties {
  return {
    display: 'grid',
    gap: '0.32rem',
    color: textColor,
    fontSize: compact ? '0.82rem' : '0.86rem',
    fontWeight: 700,
  }
}

function fieldInputStyle(
  background: string,
  borderColor: string,
  textColor: string,
  radius: number,
  compact: boolean,
): CSSProperties {
  return {
    width: '100%',
    padding: compact ? '0.6rem 0.7rem' : '0.7rem 0.8rem',
    borderRadius: radius,
    border: `1px solid ${borderColor}`,
    background,
    color: textColor,
    fontSize: compact ? '0.84rem' : '0.9rem',
    outline: 'none',
    minWidth: 0,
  }
}

function helperCardStyle(colors: ReturnType<typeof bannerColors>, compact: boolean): CSSProperties {
  return {
    borderRadius: compact ? 6 : 8,
    border: `1px solid ${colors.baseBorder}`,
    background: colors.baseBg,
    color: colors.baseMuted,
    padding: compact ? '0.7rem' : '0.8rem',
    fontSize: compact ? '0.78rem' : '0.82rem',
    lineHeight: 1.45,
  }
}
