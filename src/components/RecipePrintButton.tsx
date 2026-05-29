'use client'

export default function RecipePrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        backgroundColor: 'transparent',
        border: '1px solid #c0392b',
        color: '#c0392b',
        borderRadius: '6px',
        padding: '0.4rem 1rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      🖨 Распечатать рецепт
    </button>
  )
}
