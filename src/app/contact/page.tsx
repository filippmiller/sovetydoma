import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import ContactDeveloperForm from '@/components/ContactDeveloperForm'
import { canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Связаться с разработчиком',
  description: 'Форма связи с разработчиком сайта СоветыДома: ошибки в материалах, предложения тем, реклама и партнёрство, технические вопросы.',
  alternates: { canonical: canonicalPath('/contact/') },
  openGraph: {
    title: 'Связаться с разработчиком',
    description: 'Сообщите об ошибке в статье, предложите тему, уточните по рекламе или задайте технический вопрос.',
    url: canonicalPath('/contact/'),
    type: 'website',
  },
}

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Связаться с разработчиком',
        url: 'https://1001sovet.ru/contact/',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'technical support',
          email: 'alexmiller.idothings@gmail.com',
          availableLanguage: ['ru', 'en'],
        },
      }) }} />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem 1rem 3rem' }}>
        <nav aria-label="Хлебные крошки" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          <Link href="/" style={{ color: '#8b5a4a', textDecoration: 'none' }}>Главная</Link>
          <span style={{ color: '#aaa' }}> / </span>
          <span style={{ color: '#777' }}>Связаться с разработчиком</span>
        </nav>

        <header style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '2rem', lineHeight: 1.2, margin: '0 0 0.75rem', color: '#1a1a1a' }}>
            Связаться с разработчиком
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '1rem', lineHeight: 1.7 }}>
            Выберите тему обращения. Мы отвечаем на вопросы по статьям, сообщения об ошибках, предложения тем и запросы по рекламе и партнёрству.
          </p>
        </header>

        <Suspense fallback={<div style={{ padding: '1rem', color: '#888' }}>Загрузка формы...</div>}>
          <ContactDeveloperForm />
        </Suspense>
      </div>
    </>
  )
}
