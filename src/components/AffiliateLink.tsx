// AffiliateLink.tsx — server component
// Renders a styled "buy" pill for affiliate/partner links in MDX articles.
// Usage in MDX: <AffiliateLink href="..." label="..." price="999 ₽" store="ozon" />

interface AffiliateLinkProps {
  href: string
  label: string
  price?: string
  store?: 'ozon' | 'wildberries' | 'other'
}

const STORE_CONFIG: Record<
  NonNullable<AffiliateLinkProps['store']>,
  { name: string; color: string; bg: string }
> = {
  ozon: {
    name: 'Ozon',
    color: '#005bff',
    bg: '#e8f0ff',
  },
  wildberries: {
    name: 'WB',
    color: '#cb11ab',
    bg: '#fce8f8',
  },
  other: {
    name: 'Магазин',
    color: '#555555',
    bg: '#f2f2f2',
  },
}

export default function AffiliateLink({
  href,
  label,
  price,
  store = 'other',
}: AffiliateLinkProps) {
  const cfg = STORE_CONFIG[store] ?? STORE_CONFIG.other

  return (
    <span style={{ display: 'inline-block', position: 'relative' }} className="affiliate-link-wrap">
      <a
        href={href}
        rel="nofollow sponsored"
        target="_blank"
        aria-label={`${label}${price ? ` — ${price}` : ''} (партнёрская ссылка, ${cfg.name})`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.9rem',
          borderRadius: '2rem',
          border: `1.5px solid ${cfg.color}33`,
          backgroundColor: cfg.bg,
          color: cfg.color,
          fontSize: '0.875rem',
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.15s ease, transform 0.15s ease',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLAnchorElement
          el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.14)'
          el.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLAnchorElement
          el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
          el.style.transform = 'translateY(0)'
        }}
      >
        {/* Store badge */}
        <span
          style={{
            display: 'inline-block',
            padding: '1px 7px',
            borderRadius: '1rem',
            backgroundColor: cfg.color,
            color: '#fff',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.03em',
          }}
        >
          {cfg.name}
        </span>

        {/* Product label */}
        <span>{label}</span>

        {/* Price (optional) */}
        {price && (
          <span
            style={{
              padding: '1px 8px',
              borderRadius: '1rem',
              backgroundColor: cfg.color + '18',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            {price}
          </span>
        )}

        {/* External arrow */}
        <span aria-hidden="true" style={{ fontSize: '0.85rem', opacity: 0.7 }}>
          →
        </span>
      </a>

      {/* "Партнёрская ссылка" tooltip */}
      <style>{`
        .affiliate-link-wrap:hover .affiliate-tooltip {
          opacity: 1;
          pointer-events: auto;
        }
      `}</style>
      <span
        className="affiliate-tooltip"
        role="tooltip"
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#333',
          color: '#fff',
          fontSize: '0.72rem',
          padding: '3px 8px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s ease',
          zIndex: 10,
        }}
      >
        Партнёрская ссылка
      </span>
    </span>
  )
}
