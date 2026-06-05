'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Article } from '@/lib/articles'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'

interface Props {
  article: Article
}

const CATEGORY_LABELS: Record<string, string> = {
  kulinaria: 'Кулинария',
  'dom-i-uborka': 'Дом и уборка',
  'dacha-i-ogorod': 'Дача и огород',
  layfkhaki: 'Лайфхаки',
  ekonomiya: 'Экономия',
  rybalka: 'Рыбалка',
  'zdorovie-i-bezopasnost': 'Здоровье и безопасность',
  'semya-i-deti': 'Семья и дети',
  'krasota-i-uhod': 'Красота и уход',
  'otdyh-i-puteshestviya': 'Отдых и путешествия',
  'pokupki-i-tehnika': 'Покупки и техника',
}

const CATEGORY_COLORS: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
  rybalka: '#2c7da0',
  'zdorovie-i-bezopasnost': '#c0392b',
  'semya-i-deti': '#8e44ad',
  'krasota-i-uhod': '#e91e63',
  'otdyh-i-puteshestviya': '#2980b9',
  'pokupki-i-tehnika': '#f39c12',
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{
        padding: '0.6rem 1rem 0.6rem 1.5rem',
        fontSize: '0.82rem',
        fontWeight: 600,
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        verticalAlign: 'top',
        width: '160px',
      }}>
        {label}
      </td>
      <td style={{ padding: '0.6rem 1.5rem 0.6rem 1rem', fontSize: '0.9rem', color: '#1a1a1a', wordBreak: 'break-word' }}>
        {value}
      </td>
    </tr>
  )
}

export default function AdminArticleDetail({ article }: Props) {
  const authState = useAdminAuth()
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(article.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // fallback: select text
    })
  }

  if (authState !== 'authed') return null

  const { frontmatter: fm, content, wordCount } = article
  const catColor = CATEGORY_COLORS[fm.category] || '#888'
  const catLabel = CATEGORY_LABELS[fm.category] || fm.category
  const liveUrl = `/${fm.category}/${fm.slug}/`

  return (
    <AdminShell activeNav="articles">
      <div style={{ padding: '2rem', maxWidth: '1000px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <Link
            href="/admin/articles/"
            style={{ color: '#888', textDecoration: 'none', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            ← Все статьи
          </Link>
          <span style={{ color: '#ddd' }}>|</span>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.85rem',
              color: '#c0392b',
              textDecoration: 'none',
              fontWeight: 600,
              padding: '3px 10px',
              border: '1px solid #f5c6c2',
              borderRadius: '5px',
              background: '#fff',
            }}
          >
            Открыть на сайте →
          </a>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
          {fm.title}
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: '4px',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: catColor,
            background: catColor + '18',
          }}>
            {catLabel}
          </span>
          {fm.schemaType && (
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: '4px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: fm.schemaType === 'Recipe' ? '#9a3412' : '#1e40af',
              background: fm.schemaType === 'Recipe' ? '#fff7ed' : '#eff6ff',
            }}>
              {fm.schemaType}
            </span>
          )}
          <span style={{ fontSize: '0.82rem', color: '#aaa' }}>{wordCount.toLocaleString('ru-RU')} слов</span>
        </div>

        {/* Metadata card */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          marginBottom: '1.5rem',
        }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', background: '#f8f8f8' }}>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Метаданные
            </h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <MetaRow label="Slug" value={<code style={{ fontFamily: 'monospace', fontSize: '0.88rem', background: '#f5f5f5', padding: '1px 6px', borderRadius: '3px' }}>{fm.slug}</code>} />
              <MetaRow label="Дата" value={new Date(fm.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <MetaRow label="Описание" value={<span style={{ color: '#555', fontStyle: 'italic' }}>{fm.description}</span>} />
              <MetaRow label="Изображение" value={<code style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: '#f5f5f5', padding: '1px 6px', borderRadius: '3px' }}>{fm.image || '—'}</code>} />
              <MetaRow label="Теги" value={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {fm.tags.map(tag => (
                    <span key={tag} style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: '#f0ede8', color: '#555' }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              } />
              {fm.schemaType && <MetaRow label="Schema Type" value={fm.schemaType} />}
              {fm.prepTime && <MetaRow label="Prep Time" value={fm.prepTime} />}
              {fm.cookTime && <MetaRow label="Cook Time" value={fm.cookTime} />}
              {fm.recipeYield && <MetaRow label="Выход" value={fm.recipeYield} />}
              {fm.recipeIngredient && fm.recipeIngredient.length > 0 && (
                <MetaRow label="Ингредиенты" value={
                  <ul style={{ margin: 0, padding: '0 0 0 1.25rem', fontSize: '0.87rem', color: '#555' }}>
                    {fm.recipeIngredient.map((ing, i) => <li key={i}>{ing}</li>)}
                  </ul>
                } />
              )}
            </tbody>
          </table>
        </div>

        {/* MDX Content */}
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #f0f0f0',
            background: '#f8f8f8',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              MDX-содержимое
            </h2>
            <button
              onClick={handleCopy}
              style={{
                padding: '0.4rem 0.9rem',
                background: copied ? '#27ae60' : '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 600,
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              {copied ? '✓ Скопировано' : '📋 Скопировать MDX'}
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: '1.25rem 1.5rem',
            fontSize: '0.82rem',
            lineHeight: 1.7,
            color: '#333',
            background: '#fafafa',
            overflowX: 'auto',
            fontFamily: "'Courier New', Consolas, monospace",
            maxHeight: '600px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {content}
          </pre>
        </div>
      </div>
    </AdminShell>
  )
}
