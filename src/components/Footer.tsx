import Link from 'next/link'
import { CATEGORIES } from '@/lib/articles'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer style={{
      backgroundColor: '#2c2c2c',
      color: '#bbb',
      marginTop: '3rem',
      padding: '2.5rem 1rem 1.5rem',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.75rem' }}>
              СоветыДома
            </div>
            <p style={{ fontSize: '0.85rem', maxWidth: '260px', lineHeight: 1.6, color: '#999' }}>
              Полезные советы, лайфхаки и рецепты для дома, дачи и кухни. Всё проверено на практике.
            </p>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
              Разделы
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {Object.values(CATEGORIES).map((cat) => (
                <li key={cat.slug}>
                  <Link
                    href={`/${cat.slug}`}
                    style={{ color: '#bbb', textDecoration: 'none', fontSize: '0.88rem' }}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{
          borderTop: '1px solid #444',
          paddingTop: '1rem',
          fontSize: '0.8rem',
          color: '#777',
        }}>
          © {year} СоветыДома. Все права защищены.
        </div>
      </div>
    </footer>
  )
}
