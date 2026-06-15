import type { CSSProperties } from 'react'
import { formatChannelLabel } from './theme'
import type { ChannelResult } from './theme'

type Colors = {
  baseBorder: string
  baseBg: string
  baseText: string
  baseMuted: string
}

interface Props {
  channels: Record<string, ChannelResult>
  colors: Colors
  cardRadius: number
  compact: boolean
  isDark: boolean
}

export default function ChannelStatusBanner({ channels, colors, cardRadius, compact, isDark }: Props) {
  return (
    <div style={{ display: 'grid', gap: '0.55rem' }}>
      <div style={{
        fontSize: compact ? '0.72rem' : '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: colors.baseMuted,
        marginBottom: '0.4rem',
      } as CSSProperties}>
        Следующие шаги
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
        {Object.entries(channels).map(([channel, details]) => (
          <div
            key={channel}
            style={{
              border: `1px solid ${colors.baseBorder}`,
              borderRadius: cardRadius,
              padding: compact ? '0.7rem' : '0.8rem',
              background: isDark ? '#2a2a2a' : '#faf9f7',
              color: colors.baseText,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: compact ? '0.84rem' : '0.9rem', marginBottom: '0.25rem' }}>
              {formatChannelLabel(channel)}
            </div>
            <div style={{ fontSize: compact ? '0.75rem' : '0.8rem', color: colors.baseMuted, lineHeight: 1.45 }}>
              {details.message || details.action || details.status || 'Заявка принята'}
            </div>
            {details.url && (
              <a
                href={details.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '0.45rem',
                  color: '#c0392b',
                  fontWeight: 700,
                  fontSize: compact ? '0.75rem' : '0.8rem',
                  textDecoration: 'none',
                }}
              >
                Открыть
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
