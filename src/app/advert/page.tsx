import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_NAME, SITE_URL, canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Реклама и партнёрство',
  description: 'Форматы сотрудничества с 1001sovet.ru: партнёрские материалы, нативные интеграции, обзоры полезных продуктов и спецпроекты. Прозрачные условия, редакционная проверка.',
  alternates: { canonical: canonicalPath('/advert/') },
  openGraph: {
    title: 'Реклама и партнёрство | 1001sovet.ru',
    description: 'Партнёрский контент и обзоры на СоветыДома. Только проверенные форматы без скрытых ссылок.',
    url: canonicalPath('/advert/'),
    type: 'website',
  },
}

const advertJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Реклама и партнёрство',
  url: `${SITE_URL}/advert/`,
  isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  description: 'Информация о форматах рекламы и партнёрства на сайте практичных советов для дома.',
}

export default function AdvertPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(advertJsonLd) }} />
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
        <nav aria-label="Хлебные крошки" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          <Link href="/" style={{ color: '#8b5a4a', textDecoration: 'none' }}>Главная</Link>
          <span style={{ color: '#aaa' }}> / </span>
          <span style={{ color: '#777' }}>Реклама и партнёрство</span>
        </nav>

        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2, margin: '0 0 0.6rem', color: '#1a1a1a' }}>
            Реклама и партнёрство
          </h1>
          <p style={{ margin: 0, color: '#555', fontSize: '1.05rem', lineHeight: 1.65 }}>
            Мы работаем только с полезными продуктами и сервисами, которые реально помогают в быту.
            Все рекламные материалы помечаются, проходят редакционную проверку и не содержат скрытых SEO-ссылок.
          </p>
        </header>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Доступные форматы</h2>
          <ul style={{ paddingLeft: '1.1rem', lineHeight: 1.75, color: '#333' }}>
            <li><strong>Партнёрский материал</strong> — статья, подготовленная совместно с брендом, но в нашем стиле и с реальными проверками.</li>
            <li><strong>Нативная интеграция</strong> — упоминание продукта или сервиса внутри существующей или новой практической статьи (с пометкой).</li>
            <li><strong>Обзор полезного продукта/сервиса</strong> — честный разбор: плюсы, минусы, для кого подойдёт, альтернативы. Без «лучший в мире».</li>
            <li><strong>Спецпроект</strong> — серия материалов, чек-листы, калькуляторы или инструменты под задачу бренда (например, «Подготовка дачи к сезону»).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem', background: '#faf8f6', border: '1px solid #e8e4df', borderRadius: '10px', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.6rem' }}>Что обязательно</h2>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7, color: '#333' }}>
            <li>Явная пометка «Партнёрский материал» или «При поддержке» в начале и в конце.</li>
            <li>Редакционная проверка: мы не публикуем материалы, которые вводят читателя в заблуждение.</li>
            <li>Отказ от скрытых SEO-ссылок и «вечных» dofollow без disclosure.</li>
            <li>Не принимаем предложения с сомнительными медицинскими, финансовыми или «гарантированными» обещаниями.</li>
            <li>Честные отзывы и реальные тесты — если продукт не подошёл, пишем об этом.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Как начать</h2>
          <p style={{ marginBottom: '1rem', color: '#444' }}>
            Напишите нам через форму контактов. Выберите тему «Реклама и партнёрство» и кратко опишите формат и продукт.
            Мы ответим в течение нескольких дней.
          </p>
          <Link
            href="/contact/?topic=advertising"
            style={{
              display: 'inline-block',
              background: '#c0392b',
              color: '#fff',
              padding: '0.7rem 1.6rem',
              borderRadius: '8px',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.95rem',
            }}
          >
            Предложить партнёрство →
          </Link>
        </section>

        <p style={{ fontSize: '0.82rem', color: '#777', lineHeight: 1.6 }}>
          Мы не размещаем «вечные» ссылки без контекста, не участвуем в ссылочном спаме и не даём гарантий по позициям в поиске.
          Наш приоритет — польза для читателей.
        </p>

        <p style={{ marginTop: '1.5rem' }}>
          <Link href="/" style={{ color: '#c0392b' }}>← На главную</Link>
        </p>
      </div>
    </>
  )
}
