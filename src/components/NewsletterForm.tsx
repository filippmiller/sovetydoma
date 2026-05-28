'use client'

export default function NewsletterForm() {
  return (
    <form onSubmit={(e) => { e.preventDefault(); alert('Скоро запустим рассылку!') }}
      style={{ display: 'flex', gap: '0.4rem' }}>
      <input
        type="email"
        placeholder="ваш@email.ru"
        style={{
          flex: 1, padding: '0.5rem 0.75rem', borderRadius: '5px',
          border: '1px solid #444', background: '#3a3a3a',
          color: '#eee', fontSize: '0.83rem', outline: 'none', minWidth: 0,
        }}
      />
      <button type="submit" style={{
        background: '#c0392b', color: '#fff', border: 'none',
        borderRadius: '5px', padding: '0.5rem 0.75rem',
        fontSize: '0.83rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
      }}>
        ОК
      </button>
    </form>
  )
}
