import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import YandexMetrika from '@/components/YandexMetrika'
import BackToTop from '@/components/BackToTop'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pogovorim.vsedomatut.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'СоветыДома — полезные советы для дома, кухни и дачи',
    template: '%s | СоветыДома',
  },
  description:
    'Лайфхаки, рецепты, советы по уборке, огороду и экономии. Всё проверено на практике — просто и понятно.',
  openGraph: {
    siteName: 'СоветыДома',
    locale: 'ru_RU',
    type: 'website',
    images: [{ url: '/og-default.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sovetydoma',
    creator: '@sovetydoma',
  },
  robots: { index: true, follow: true },
  other: {
    'yandex-verification': process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || '',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        {/* Google Fonts — preconnect first, then stylesheet (non-blocking) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400&display=swap"
        />
        <link rel="alternate" hrefLang="ru" href={SITE_URL} />
        <link rel="alternate" type="application/rss+xml" title="СоветыДома RSS" href={`${SITE_URL}/feed.xml`} />
        <link rel="alternate" type="application/rss+xml" title="СоветыДома — Кулинария" href={`${SITE_URL}/feed-kulinaria.xml`} />
        <link rel="alternate" type="application/rss+xml" title="СоветыДома — Дом и уборка" href={`${SITE_URL}/feed-dom-i-uborka.xml`} />
        <link rel="alternate" type="application/rss+xml" title="СоветыДома — Дача и огород" href={`${SITE_URL}/feed-dacha-i-ogorod.xml`} />
        <link rel="alternate" type="application/rss+xml" title="СоветыДома — Лайфхаки" href={`${SITE_URL}/feed-layfkhaki.xml`} />
        <link rel="alternate" type="application/rss+xml" title="СоветыДома — Экономия" href={`${SITE_URL}/feed-ekonomiya.xml`} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#c0392b" />
      </head>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', margin: 0 }}>
        <a href="#main-content" className="skip-link">Перейти к содержимому</a>
        <YandexMetrika />
        <Header />
        <main id="main-content" style={{ flex: 1 }}>{children}</main>
        <Footer />
        <BackToTop />
      </body>
    </html>
  )
}
