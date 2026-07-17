'use client'

interface SeasonConfig {
  emoji: string
  text: string
  category: string
  categoryName: string
  color: string
}

const SEASONS: SeasonConfig[] = [
  // Dec (11), Jan (0), Feb (1) — winter
  { emoji: '❄️', text: 'Зима — сезон домашних заготовок и уюта', category: 'dom-i-uborka', categoryName: 'Дом и уборка', color: '#2980b9' },
  // Mar (2), Apr (3), May (4) — spring
  { emoji: '🌱', text: 'Весна — время сажать рассаду и убираться', category: 'dacha-i-ogorod', categoryName: 'Дача и огород', color: '#27ae60' },
  // Jun (5), Jul (6), Aug (7) — summer
  { emoji: '☀️', text: 'Лето — дача, огород и свежие рецепты', category: 'dacha-i-ogorod', categoryName: 'Дача и огород', color: '#e67e22' },
  // Sep (8), Oct (9), Nov (10) — autumn
  { emoji: '🍄', text: 'Осень — заготовки, грибы и тёплые рецепты', category: 'kulinaria', categoryName: 'Кулинария', color: '#c0392b' },
]

function getSeason(): SeasonConfig {
  const month = new Date().getMonth() // 0-11
  if (month === 11 || month === 0 || month === 1) return SEASONS[0] // winter
  if (month >= 2 && month <= 4) return SEASONS[1]  // spring
  if (month >= 5 && month <= 7) return SEASONS[2]  // summer
  return SEASONS[3]                                  // autumn (8-10)
}

export default function SeasonalBanner() {
  const season = getSeason()

  return (
    <a
      href={`/${season.category}`}
      suppressHydrationWarning
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.85rem 1.25rem',
        marginBottom: '2rem',
        borderRadius: '10px',
        background: `linear-gradient(135deg, ${season.color}18, ${season.color}08)`,
        border: `1.5px solid ${season.color}33`,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.15s',
      }}
      aria-label={`${season.text} — перейти в раздел ${season.categoryName}`}
    >
      <span style={{ fontSize: '1.5rem', flexShrink: 0 }} aria-hidden="true">
        {season.emoji}
      </span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: '0.93rem', fontWeight: 700, color: season.color }}>
          {season.text}
        </span>
      </div>
      <span style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        color: season.color,
        opacity: 0.85,
        whiteSpace: 'nowrap',
      }}>
        {season.categoryName} →
      </span>
    </a>
  )
}
