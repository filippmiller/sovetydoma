import { Suspense } from 'react'
import type { Metadata } from 'next'
import PodpiskiClient from './PodpiskiClient'
import { canonicalPath } from '@/lib/seo'

export const metadata: Metadata = {
  title: 'Подписки',
  description: 'Подписка на категории, каналы доставки и управление подтверждением.',
  alternates: { canonical: canonicalPath('/podpiski/') },
  robots: { index: false },
}

export default function PodpiskiPage() {
  return (
    <Suspense fallback={<div style={{ maxWidth: '980px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>Загрузка...</div>}>
      <PodpiskiClient />
    </Suspense>
  )
}
