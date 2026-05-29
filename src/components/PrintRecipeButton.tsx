'use client'

export default function PrintRecipeButton() {
  return (
    <button
      onClick={() => window.print()}
      aria-label="Распечатать рецепт"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.4rem 1rem',
        background: 'none',
        color: '#555',
        border: '1.5px solid #ccc',
        borderRadius: '6px',
        fontSize: '0.85rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'border-color 0.2s, color 0.2s',
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget
        btn.style.borderColor = '#c0392b'
        btn.style.color = '#c0392b'
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget
        btn.style.borderColor = '#ccc'
        btn.style.color = '#555'
      }}
    >
      🖨️ Распечатать рецепт
    </button>
  )
}
