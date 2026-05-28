import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import YandexMetrika from '@/components/YandexMetrika'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sovetydoma.ru'

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
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <YandexMetrika />
        <Header />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
