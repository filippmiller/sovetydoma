import { resolvePersona } from '@/lib/personas'

interface Props {
  author?: string
  category?: string
  updated?: string   // formatted date string
}

function fmtDate(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Visible article attribution. Uses an AI-assisted editorial persona; the role
 * line and disclosure make clear this is a virtual editor, not a real person.
 */
export default function ArticlePersonaCard({ author, category, updated }: Props) {
  const p = resolvePersona({ author, category })
  const updatedStr = fmtDate(updated)

  return (
    <div
      style={{
        display: 'flex', gap: '0.85rem', alignItems: 'flex-start',
        background: '#faf9f7', border: '1px solid #eee6db', borderRadius: '10px',
        padding: '0.9rem 1rem', margin: '0 0 1.5rem',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: '#fff', border: '1px solid #eadfce',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
        }}
      >
        {p.icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>
          {p.name}{' '}
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, verticalAlign: 'middle',
            background: '#eef2ff', color: '#3b5bdb', borderRadius: '4px', padding: '1px 6px', marginLeft: '0.25rem',
          }}>
            AI-редактор
          </span>
        </div>
        <div style={{ fontSize: '0.82rem', color: '#777', marginTop: '0.1rem' }}>{p.role}</div>
        {updatedStr && (
          <div style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '0.25rem' }}>Обновлено: {updatedStr}</div>
        )}
        <div style={{ fontSize: '0.72rem', color: '#b3a896', marginTop: '0.4rem', lineHeight: 1.4 }}>
          {p.disclosure}
        </div>
      </div>
    </div>
  )
}
