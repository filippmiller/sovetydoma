'use client'

import Link from 'next/link'
import type { ArticleFrontmatter } from '@/lib/articles'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'

interface Props {
  articles: (ArticleFrontmatter & { wordCount: number })[]
  categories: Record<string, { name: string; slug: string; description: string }>
}

function StatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderTop: `4px solid ${color}`,
      minWidth: 0,
    }}>
      <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1a1a1a', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

export default function AdminDashboard({ articles, categories }: Props) {
  const authState = useAdminAuth()

  if (authState !== 'authed') return null

  // Compute stats
  const totalArticles = articles.length
  const totalCategories = Object.keys(categories).length
  const allTags = new Set(articles.flatMap(a => a.tags))
  const totalTags = allTags.size
  const latestDate = articles.length > 0 ? articles[0].date : '—'

  // Category breakdown
  const catBreakdown = Object.entries(categories).map(([slug, cat]) => {
    const catArticles = articles.filter(a => a.category === slug)
    const latest = catArticles.length > 0 ? catArticles[0].date : null
    return { slug, name: cat.name, count: catArticles.length, latest }
  }).sort((a, b) => b.count - a.count)

  // Recent articles (top 10)
  const recentArticles = articles.slice(0, 10)

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const CATEGORY_COLOR: Record<string, string> = {
    kulinaria: '#e67e22',
    'dom-i-uborka': '#27ae60',
    'dacha-i-ogorod': '#16a085',
    layfkhaki: '#8e44ad',
    ekonomiya: '#2980b9',
    rybalka: '#2c7da0',
  }

  return (
    <AdminShell activeNav="overview">
      <div style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', marginBottom: '0.25rem', marginTop: 0 }}>
          Обзор
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '2rem', marginTop: 0 }}>
          Добро пожаловать в панель управления СоветыДома
        </p>

        {/* Stats cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}>
          <StatCard icon="📄" value={totalArticles} label="Статей" color="#c0392b" />
          <StatCard icon="🗂️" value={totalCategories} label="Категорий" color="#e67e22" />
          <StatCard icon="🏷️" value={totalTags} label="Уникальных тегов" color="#8e44ad" />
          <StatCard icon="📅" value={latestDate ? formatDate(latestDate) : '—'} label="Последняя статья" color="#27ae60" />
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {/* Category breakdown */}
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f0f0f0' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>Категории</h2>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8f8f8' }}>
                  <th style={{ padding: '0.6rem 1.5rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Категория</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: '#888', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Статей</th>
                  <th style={{ padding: '0.6rem 1.5rem', textAlign: 'right', color: '#888', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Последняя</th>
                </tr>
              </thead>
              <tbody>
                {catBreakdown.map((cat, i) => (
                  <tr key={cat.slug} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.75rem 1.5rem' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: CATEGORY_COLOR[cat.slug] || '#888',
                        marginRight: '0.5rem',
                        verticalAlign: 'middle',
                      }} />
                      {cat.name}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: '#1a1a1a' }}>{cat.count}</td>
                    <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', color: '#888' }}>
                      {cat.latest ? formatDate(cat.latest) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent articles */}
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>Последние статьи</h2>
              <Link href="/admin/articles/" style={{ fontSize: '0.82rem', color: '#c0392b', textDecoration: 'none', fontWeight: 600 }}>Все →</Link>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8f8f8' }}>
                  <th style={{ padding: '0.6rem 1.5rem', textAlign: 'left', color: '#888', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Заголовок</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#888', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Слов</th>
                </tr>
              </thead>
              <tbody>
                {recentArticles.map((art, i) => (
                  <tr key={art.slug} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderTop: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.65rem 1.5rem' }}>
                      <div style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.85rem', lineHeight: 1.3, marginBottom: '0.15rem' }}>
                        <Link href={`/admin/articles/${art.slug}/`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {art.title.length > 55 ? art.title.slice(0, 55) + '…' : art.title}
                        </Link>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#aaa' }}>{formatDate(art.date)}</div>
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#888', fontSize: '0.82rem' }}>
                      {art.wordCount.toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
