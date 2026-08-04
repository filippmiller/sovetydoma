import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo'

const destination = '/kulinaria/'

/**
 * Legacy entry point for the originally announced healthy-eating section.
 * "Здоровая еда" is a Kулинария subcategory, so retaining this page prevents
 * shared links from becoming 404s without creating a duplicate indexable
 * top-level taxonomy.
 */
export const metadata: Metadata = {
  title: 'Здоровое питание — СоветыДома',
  alternates: { canonical: `${SITE_URL}${destination}` },
  robots: { index: false, follow: true },
}

export default function HealthyEatingLegacyPage() {
  return (
    <main style={{ maxWidth: '680px', margin: '4rem auto', padding: '2rem 1rem', textAlign: 'center' }}>
      <div aria-hidden="true" style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔄</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Раздел переехал</h1>
      <p style={{ color: '#555', marginBottom: '1.5rem' }}>
        Материалы о здоровом питании теперь находятся в разделе «Кулинария».
      </p>
      <Link href={destination} style={{ color: '#c0392b', fontWeight: 700 }}>
        Перейти к актуальному разделу →
      </Link>
      <script dangerouslySetInnerHTML={{ __html: `setTimeout(function(){ if (location.pathname !== ${JSON.stringify(destination)}) location.replace(${JSON.stringify(destination)}); }, 900);` }} />
    </main>
  )
}
