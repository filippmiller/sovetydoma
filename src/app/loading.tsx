export default function Loading() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Skeleton header */}
      <div style={{ height: '36px', width: '60%', background: '#eee', borderRadius: '6px', marginBottom: '0.75rem', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: '20px', width: '40%', background: '#eee', borderRadius: '4px', marginBottom: '2rem', animation: 'pulse 1.5s ease-in-out infinite' }} />

      {/* Skeleton grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ height: '160px', background: '#f0ede8', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ padding: '1rem' }}>
              <div style={{ height: '16px', width: '40%', background: '#f0ede8', borderRadius: '4px', marginBottom: '0.6rem' }} />
              <div style={{ height: '20px', width: '90%', background: '#f0ede8', borderRadius: '4px', marginBottom: '0.4rem' }} />
              <div style={{ height: '20px', width: '75%', background: '#f0ede8', borderRadius: '4px', marginBottom: '0.75rem' }} />
              <div style={{ height: '14px', width: '50%', background: '#f0ede8', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
