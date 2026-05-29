import type { Metadata } from 'next'
import { getAllArticles, CATEGORIES } from '@/lib/articles'

export const metadata: Metadata = {
  title: 'О сайте',
  description: 'СоветыДома — сайт с практичными советами для дома, кухни, дачи и экономии для жителей России',
}

export default function AboutPage() {
  const articles = getAllArticles()

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '1.5rem' }}>О сайте</h1>

      <div className="prose">
        <p>
          <strong>СоветыДома</strong> — это сборник практичных советов, рецептов и лайфхаков для повседневной жизни.
          Мы пишем о том, что реально работает: проверенные рецепты, способы убраться быстрее,
          советы для дачи и огорода, и идеи как сэкономить без потери качества жизни.
        </p>

        <h2>Что вы найдёте на сайте</h2>
        <p>
          На сайте {articles.length} статей в {Object.keys(CATEGORIES).length} разделах:
        </p>
        <ul>
          {Object.values(CATEGORIES).map((cat) => {
            const count = articles.filter((a) => a.category === cat.slug).length
            return (
              <li key={cat.slug}>
                <strong>{cat.name}</strong> ({count} {count === 1 ? 'статья' : count < 5 ? 'статьи' : 'статей'}) — {cat.description.toLowerCase()}
              </li>
            )
          })}
        </ul>

        <h2>Наш подход</h2>
        <p>
          Каждый совет мы проверяем на практике или берём у людей с реальным опытом.
          Никаких «лайфхаков» из интернета, которые не работают. Только то, что действительно
          помогает в быту жителям России.
        </p>

        <h2>Контакт</h2>
        <p>
          Есть вопросы, предложения или хотите поделиться своим советом? Напишите нам:
          {' '}<a href="mailto:redaktion@sovetydoma.ru" style={{ color: '#c0392b' }}>redaktion@sovetydoma.ru</a>
        </p>
      </div>
    </div>
  )
}
