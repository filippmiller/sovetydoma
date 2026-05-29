interface CostBadgeProps {
  cost: string
}

export default function CostBadge({ cost }: CostBadgeProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      background: '#fff9e6',
      color: '#8b6914',
      border: '1px solid #f0c040',
      borderRadius: '999px',
      padding: '3px 10px',
      fontSize: '0.78rem',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      💰 {cost}
    </span>
  )
}
