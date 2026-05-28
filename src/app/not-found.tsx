import Link from 'next/link'
import { CATEGORIES } from '@/lib/articles'

export default function NotFound() {
  return (
    <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem 1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🏠</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.5rem' }}>
        Страница не найдена
      </h1>
      <p style={{ color: '#777', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
        Возможно, ссылка устарела или страница была перемещена.
        Попробуйте найти нужное в одном из разделов:
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center', marginBottom: '2rem' }}>
        {Object.values(CATEGORIES).map((cat) => (
          <Link key={cat.slug} href={`/${cat.slug}`} style={{
            padding: '0.5rem 1.1rem', borderRadius: '999px',
            border: '1.5px solid #e0dbd5', textDecoration: 'none',
            color: '#444', fontSize: '0.9rem', backgroundColor: '#fff', fontWeight: 500,
          }}>
            {cat.name}
          </Link>
        ))}
      </div>
      <Link href="/" style={{
        display: 'inline-block', padding: '0.7rem 1.75rem',
        backgroundColor: '#c0392b', color: '#fff',
        borderRadius: '8px', textDecoration: 'none',
        fontWeight: 700, fontSize: '0.95rem',
      }}>
        На главную
      </Link>
    </div>
  )
}
