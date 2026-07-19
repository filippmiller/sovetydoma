import Link from 'next/link'
import { CATEGORIES, getAllArticles } from '@/lib/articles'
import NewsletterForm from './NewsletterForm'

function pluralArticles(n: number): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return 'статья'
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'статьи'
  return 'статей'
}

// getAllArticles() only counts the static MDX corpus; ~2200 more are published
// dynamically from content_matrix. This typed inline script (kept by the
// renderer's script-strip, runs on static AND dynamic pages) fetches the
// published-dynamic count and folds it into the footer total. Degrades to the
// static number if the worker is unreachable.
const FOOTER_COUNT_SCRIPT = `(function(){var el=document.getElementById('site-article-total');`
  + `if(!el||el.dataset.cntBound)return;el.dataset.cntBound='1';`
  + `var stat=parseInt(el.getAttribute('data-static'),10)||0;`
  + `fetch('https://sovetydoma-photo-upload.filippmiller.workers.dev/article-count')`
  + `.then(function(r){return r.ok?r.json():null;}).then(function(d){`
  + `if(!d||typeof d.published!=='number'||d.published<=0)return;var total=stat+d.published;`
  + `el.textContent=String(total);var w=document.getElementById('site-article-word');`
  + `if(w){var m10=total%10,m100=total%100,word='статей';`
  + `if(m10===1&&m100!==11)word='статья';else if(m10>=2&&m10<=4&&(m100<10||m100>=20))word='статьи';`
  + `w.textContent=word;}}).catch(function(){});})();`

export default function Footer() {
  const year = new Date().getFullYear()
  const totalArticles = getAllArticles().length

  return (
    <footer style={{ backgroundColor: '#2c2c2c', color: '#bbb', marginTop: '3rem', padding: '2.5rem 1rem 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>

          {/* Brand */}
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.3rem', marginBottom: '0.4rem', letterSpacing: '-0.3px' }}>
              <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>СоветыДома</Link>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.65, color: '#c0bdb8', marginBottom: '0.75rem' }}>
              Практичные советы для жизни в России: кухня, дом, дача и экономия. Всё проверено на практике.
            </p>
            <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '0.75rem' }}>
              <span id="site-article-total" data-static={totalArticles}>{totalArticles}</span>{' '}
              <span id="site-article-word">{pluralArticles(totalArticles)}</span> · {Object.keys(CATEGORIES).length} разделов
            </p>
            <script type="text/javascript" dangerouslySetInnerHTML={{ __html: FOOTER_COUNT_SCRIPT }} />
            {/* RSS link */}
            <Link href="/feed.xml" style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              color: '#e67e22', fontSize: '0.78rem', fontWeight: 700,
              textDecoration: 'none', padding: '4px 10px', borderRadius: '5px',
              border: '1.5px solid #e67e2244', backgroundColor: '#e67e2212',
            }}>
              📡 RSS-лента
            </Link>
            {/* Telegram channel */}
            <a href="https://t.me/sovetydoma" style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              color: '#229ED9', fontSize: '0.78rem', fontWeight: 700,
              textDecoration: 'none', padding: '4px 10px', borderRadius: '5px',
              border: '1.5px solid #229ED944', backgroundColor: '#229ED912',
              marginTop: '6px',
            }}>
              📢 Telegram-канал
            </a>
          </div>

          {/* Categories */}
          <div>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: '0.85rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Разделы</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.values(CATEGORIES).map((cat) => (
                <li key={cat.slug} style={{ marginBottom: '0.45rem' }}>
                  <Link href={`/${cat.slug}`} style={{ color: '#c0bdb8', textDecoration: 'none', fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>{cat.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter CTA */}
          <div>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: '0.85rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Новые советы на почту</div>
            <p style={{ fontSize: '0.85rem', color: '#c0bdb8', marginBottom: '0.85rem', lineHeight: 1.6 }}>
              Раз в неделю — лучший совет недели. Уже 500+ читателей. Отписка в 1 клик.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: '1.1rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem', color: '#777' }}>
          <span>© {year} СоветыДома. Все права защищены.</span>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link href="/about" style={{ color: '#999', textDecoration: 'none' }}>О сайте</Link>
            <Link href="/advert/" style={{ color: '#999', textDecoration: 'none' }}>Реклама</Link>
            <Link href="/contact" style={{ color: '#999', textDecoration: 'none' }}>Контакты</Link>
            <Link href="/terms/" style={{ color: '#999', textDecoration: 'none' }}>Условия</Link>
            <Link href="/privacy/" style={{ color: '#999', textDecoration: 'none' }}>Конфиденциальность</Link>
            <Link href="/cookies/" style={{ color: '#999', textDecoration: 'none' }}>Cookies</Link>
            <Link href="/feed.xml" style={{ color: '#999', textDecoration: 'none' }}>RSS</Link>
            <Link href="/stati/" style={{ color: '#999', textDecoration: 'none' }}>Все материалы</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
