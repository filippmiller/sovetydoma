// SponsoredBadge.tsx — server component
// Shown at the top of articles where fm.sponsored === true.
// Informs readers that the article is sponsored/partner content.

export default function SponsoredBadge() {
  return (
    <div
      role="note"
      aria-label="Партнёрский материал"
      style={{
        width: '100%',
        backgroundColor: '#fff8e8',
        borderBottom: '1px solid #f0d080',
        color: '#d4720a',
        textAlign: 'center',
        padding: '0.55rem 1rem',
        fontSize: '0.82rem',
        fontWeight: 500,
        letterSpacing: '0.01em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '0.95rem' }}>ℹ</span>
      <span>Партнёрский материал — статья создана при поддержке рекламодателя</span>
    </div>
  )
}
