import type { ArticleFrontmatter } from '@/lib/articles'

interface Props {
  fm: ArticleFrontmatter
}

// Category-aware prompt so the CTA feels specific ("Сделали заготовки?" etc).
const PROMPTS: Record<string, string> = {
  kulinaria: 'Приготовили по рецепту?',
  'dom-i-uborka': 'Навели порядок или вывели пятно?',
  'dacha-i-ogorod': 'Вырастили или починили что-то на даче?',
  layfkhaki: 'Попробовали лайфхак?',
  ekonomiya: 'Сэкономили по нашим советам?',
}

/**
 * "Покажите, что получилось" CTA. Upload backend is not ready, so the controls
 * are rendered as a disabled coming-soon state — never broken/clickable inputs.
 */
export default function ArticlePhotoSubmissionCTA({ fm }: Props) {
  const prompt = PROMPTS[fm.category] || 'Получилось по нашим советам?'

  return (
    <section
      aria-label="Покажите, что получилось"
      style={{
        marginTop: '2rem', background: 'linear-gradient(135deg, #fff7ed 0%, #fdf2f8 100%)',
        border: '1px dashed #e7c9a8', borderRadius: '12px', padding: '1.4rem 1.25rem', textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>📸</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.25rem' }}>
        Покажите, что получилось
      </div>
      <p style={{ fontSize: '0.9rem', color: '#7a6f63', margin: '0 0 1rem' }}>{prompt} Поделитесь результатом с другими читателями.</p>
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button disabled title="Скоро" style={comingBtn}>📷 Добавить фото результата</button>
        <button disabled title="Скоро" style={comingBtn}>💬 Добавить комментарий</button>
      </div>
      <div style={{ fontSize: '0.72rem', color: '#b09b86', marginTop: '0.7rem' }}>Скоро можно будет загружать фото</div>
    </section>
  )
}

const comingBtn: React.CSSProperties = {
  padding: '0.55rem 1.1rem', borderRadius: '8px', border: '1.5px solid #e0d3c2',
  background: '#fff', color: '#b0a392', fontSize: '0.88rem', fontWeight: 600,
  cursor: 'not-allowed', fontFamily: 'inherit', opacity: 0.85,
}
