import Link from 'next/link'
import { CATEGORIES, getAllArticles } from '@/lib/articles'
import NewsletterForm from './NewsletterForm'

export default function Footer() {
  const year = new Date().getFullYear()
  const totalArticles = getAllArticles().length

  return (
    <footer style={{ backgroundColor: '#2c2c2c', color: '#bbb', marginTop: '3rem', padding: '2.5rem 1rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>

          {/* Brand */}
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>СоветыДома</div>
            <p style={{ fontSize: '0.83rem', lineHeight: 1.6, color: '#999', marginBottom: '0.5rem' }}>
              Практичные советы для жизни в России: кухня, дом, дача и экономия.
            </p>
            <p style={{ fontSize: '0.78rem', color: '#666' }}>
              {totalArticles} {totalArticles === 1 ? 'статья' : totalArticles < 5 ? 'статьи' : 'статей'} · {Object.keys(CATEGORIES).length} разделов
            </p>
          </div>

          {/* Categories */}
          <div>
            <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Разделы</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.values(CATEGORIES).map((cat) => (
                <li key={cat.slug} style={{ marginBottom: '0.35rem' }}>
                  <Link href={`/${cat.slug}`} style={{ color: '#bbb', textDecoration: 'none', fontSize: '0.88rem' }}>
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter CTA */}
          <div>
            <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Новые советы</div>
            <p style={{ fontSize: '0.83rem', color: '#999', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Подпишитесь — пришлём лучшие лайфхаки раз в неделю.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.78rem', color: '#666' }}>
          <span>© {year} СоветыДома. Все права защищены.</span>
          <Link href="/about" style={{ color: '#666', textDecoration: 'none' }}>О сайте</Link>
        </div>
      </div>
    </footer>
  )
}
