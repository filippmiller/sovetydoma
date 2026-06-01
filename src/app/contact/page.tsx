import type { Metadata } from 'next'
import Link from 'next/link'
import ContactDeveloperForm from '@/components/ContactDeveloperForm'
import { SITE_NAME, SITE_URL, canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Связаться с разработчиком',
  description: 'Форма связи с разработчиком сайта СоветыДома: ошибки, предложения, SEO и технические вопросы.',
  alternates: { canonical: canonicalPath('/contact/') },
  openGraph: {
    title: 'Связаться с разработчиком',
    description: 'Сообщите об ошибке, предложите улучшение или задайте технический вопрос по сайту СоветыДома.',
    url: canonicalPath('/contact/'),
    type: 'website',
  },
}

const contactJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Связаться с разработчиком',
  url: `${SITE_URL}/contact/`,
  isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'technical support',
    email: 'alexmiller.idothings@gmail.com',
    availableLanguage: ['ru', 'en'],
  },
}

export default function ContactPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />
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
            Используйте форму для технических ошибок, вопросов по индексации, предложений по улучшению сайта и сообщений о проблемах в статьях.
          </p>
        </header>

        <ContactDeveloperForm />
      </div>
    </>
  )
}
