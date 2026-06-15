import type { CSSProperties } from 'react'
import { DIRECT_CHANNELS } from './theme'

type Colors = {
  baseBg: string
  baseBorder: string
  baseText: string
  baseMuted: string
  chipBg?: string
  chipBorder?: string
  chipText?: string
}

interface Props {
  selectedChannels: string[]
  onToggle: (channel: string) => void
  colors: Colors
  cardRadius: number
  compact: boolean
  isDark: boolean
}

export default function ChannelPicker({ selectedChannels, onToggle, colors, cardRadius, compact, isDark }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.45rem' }}>
      {DIRECT_CHANNELS.map((channel) => {
        const checked = selectedChannels.includes(channel.key)
        return (
          <label
            key={channel.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              border: `1px solid ${checked ? '#c0392b' : colors.baseBorder}`,
              background: checked ? (isDark ? '#3b2424' : '#fdf3f1') : colors.baseBg,
              color: colors.baseText,
              borderRadius: cardRadius,
              padding: compact ? '0.6rem 0.7rem' : '0.7rem 0.8rem',
              cursor: 'pointer',
            } as CSSProperties}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(channel.key)}
              style={{ marginTop: '0.15rem', accentColor: '#c0392b', flexShrink: 0 }}
            />
            <span style={{ display: 'grid', gap: '0.12rem', minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: compact ? '0.84rem' : '0.9rem' }}>{channel.label}</span>
              <span style={{ fontSize: compact ? '0.74rem' : '0.78rem', color: colors.baseMuted, lineHeight: 1.35 }}>
                {channel.helper}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
