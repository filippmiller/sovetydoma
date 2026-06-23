import type { Metadata } from 'next'
import { PT_Sans } from 'next/font/google'
import './globals.css'

// Self-hosted via next/font (was an external Google Fonts <link> = extra
// DNS/TLS round-trip + FOUT, slow from Russia). Cyrillic subset is required.
const ptSans = PT_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-pt-sans',
})
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import YandexMetrika from '@/components/YandexMetrika'
import BackToTop from '@/components/BackToTop'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'
import AnalyticsTracker from '@/components/AnalyticsTracker'
import { SITE_NAME, SITE_URL, DEFAULT_OG_IMAGE } from '@/lib/seo'
import { CATEGORIES } from '@/lib/categories'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'СоветыДома — полезные советы для дома, кухни и дачи',
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Лайфхаки, рецепты, советы по уборке, огороду и экономии. Всё проверено на практике — просто и понятно.',
  openGraph: {
    siteName: SITE_NAME,
    locale: 'ru_RU',
    type: 'website',
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sovetydoma',
    creator: '@sovetydoma',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  other: {
    'yandex-verification': process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || '',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={ptSans.variable}>
      <head>
        {/* 0h3.11: strip Supabase auth tokens from the URL hash synchronously,
            before Yandex Metrika (afterInteractive) or any other script can read
            location.href and leak access_token/refresh_token to mc.yandex.ru in
            the page-url param. The raw hash is stashed on window + sessionStorage
            so the recovery/login flow can still establish the session (see
            lib/auth/recovery-hash). Must run before <YandexMetrika /> below. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var h=location.hash||"";if(h.length>1&&/(access_token|refresh_token|token_type|expires_at|expires_in)=|type=(recovery|signup|magiclink|invite|email_change)/.test(h)){window.__SB_AUTH_HASH__=h;try{sessionStorage.setItem("sb_auth_hash",h)}catch(e){}history.replaceState(null,"",location.pathname+location.search)}}catch(e){}})();',
          }}
        />
        <link rel="alternate" hrefLang="ru" href={SITE_URL} />
        <link rel="alternate" type="application/rss+xml" title="СоветыДома RSS" href={`${SITE_URL}/feed.xml`} />
        {Object.values(CATEGORIES).map((cat) => (
          <link
            key={cat.slug}
            rel="alternate"
            type="application/rss+xml"
            title={`СоветыДома — ${cat.name}`}
            href={`${SITE_URL}/feed-${cat.slug}.xml`}
          />
        ))}
        <link rel="alternate" type="application/rss+xml" title="СоветыДома Turbo" href={`${SITE_URL}/turbo.xml`} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#c0392b" />
        <meta name="msvalidate.01" content="CDA98D825323138C1BE05C96F85052EB" />
      </head>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', margin: 0 }}>
        <a href="#main-content" className="skip-link">Перейти к содержимому</a>
        <YandexMetrika />
        <Header />
        <main id="main-content" style={{ flex: 1 }}>{children}</main>
        <Footer />
        <BackToTop />
        <ServiceWorkerRegistration />
        <AnalyticsTracker />
      </body>
    </html>
  )
}
