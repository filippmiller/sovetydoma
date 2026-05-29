'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STARTER_ARTICLES = [
  {
    slug: 'idealnyy-borshch',
    category: 'kulinaria',
    title: 'Как сделать идеальный борщ: 7 секретов шеф-повара',
    emoji: '🍲',
    color: '#e67e22',
  },
  {
    slug: 'nakip-v-chaynike',
    category: 'dom-i-uborka',
    title: 'Как избавиться от накипи в чайнике за 10 минут',
    emoji: '🧹',
    color: '#27ae60',
  },
  {
    slug: 'kompost-bystro',
    category: 'dacha-i-ogorod',
    title: 'Как сделать компост быстро: горячее компостирование за 2 недели',
    emoji: '🌱',
    color: '#16a085',
  },
]

export default function StartHereSection() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      const visited = localStorage.getItem('has_visited')
      if (!visited) {
        setShow(true)
        localStorage.setItem('has_visited', '1')
      }
    } catch {
      // localStorage unavailable (SSR guard)
    }
  }, [])

  if (!show) return null

  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
          С чего начать
        </h2>
        <span style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 500 }}>— специально для новых читателей</span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '0.85rem',
      }}>
        {STARTER_ARTICLES.map((article) => (
          <Link
            key={article.slug}
            href={`/${article.category}/${article.slug}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '10px',
              border: `1.5px solid ${article.color}33`,
              padding: '0.9rem 1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              transition: 'box-shadow 0.15s',
              position: 'relative',
            }}>
              {/* "Новинка для вас" label */}
              <span style={{
                position: 'absolute',
                top: '-10px',
                left: '12px',
                background: article.color,
                color: '#fff',
                fontSize: '0.62rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Новинка для вас
              </span>
              <span style={{ fontSize: '1.8rem', lineHeight: 1, flexShrink: 0 }}>{article.emoji}</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.4 }}>
                {article.title}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
