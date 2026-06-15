export default function SkeletonCard() {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem 0' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0ede8', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: '30%', height: 12, background: '#f0ede8', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ width: '85%', height: 10, background: '#f5f3f0', borderRadius: 4, marginBottom: 6 }} />
        <div style={{ width: '70%', height: 10, background: '#f5f3f0', borderRadius: 4 }} />
      </div>
    </div>
  )
}
