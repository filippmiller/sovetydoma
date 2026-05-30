interface QA {
  question: string
  answer?: string
}

interface Props {
  /** Optional pre-seeded Q&A (e.g. derived from FAQ frontmatter later). */
  items?: QA[]
}

/**
 * "Вопросы по статье". The questions backend is not ready, so:
 *  - if items exist, render them;
 *  - otherwise show a coming-soon empty state.
 * Never exposes a broken submit control.
 */
export default function ArticleQuestionsBlock({ items = [] }: Props) {
  return (
    <section style={{ marginTop: '2.5rem', borderTop: '1px solid #f0ece7', paddingTop: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a' }}>❓ Вопросы по статье</h2>
        <button disabled title="Скоро" style={{
          padding: '0.45rem 1.1rem', borderRadius: '8px', border: '1.5px solid #e0dbd5',
          background: '#fff', color: '#b0a392', fontSize: '0.85rem', fontWeight: 600,
          cursor: 'not-allowed', fontFamily: 'inherit',
        }}>
          Задать вопрос
        </button>
      </div>

      {items.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((qa, i) => (
            <div key={i} style={{ background: '#faf9f7', border: '1px solid #ede9e4', borderRadius: '10px', padding: '0.9rem 1.1rem' }}>
              <div style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.95rem' }}>{qa.question}</div>
              {qa.answer && <p style={{ margin: '0.4rem 0 0', color: '#444', fontSize: '0.92rem', lineHeight: 1.6 }}>{qa.answer}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#999', background: '#faf9f7', border: '1.5px dashed #e8e4df', borderRadius: '12px', padding: '1.75rem 1rem' }}>
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>💬</div>
          <p style={{ margin: 0, fontSize: '0.92rem' }}>Пока вопросов нет. Скоро можно будет задать вопрос по этой статье.</p>
        </div>
      )}
    </section>
  )
}
