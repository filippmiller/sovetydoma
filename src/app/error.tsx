'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div style={{ maxWidth: '600px', margin: '4rem auto', padding: '2rem 1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚠️</div>
      <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.5rem' }}>
        Что-то пошло не так
      </h2>
      <p style={{ color: '#777', marginBottom: '2rem' }}>Произошла ошибка. Попробуйте обновить страницу.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => reset()} style={{
          padding: '0.6rem 1.5rem', backgroundColor: '#c0392b', color: '#fff',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
        }}>
          Попробовать снова
        </button>
        <Link href="/" style={{
          padding: '0.6rem 1.5rem', border: '1.5px solid #ddd',
          borderRadius: '8px', textDecoration: 'none', color: '#444', fontSize: '0.9rem',
        }}>
          На главную
        </Link>
      </div>
    </div>
  )
}
