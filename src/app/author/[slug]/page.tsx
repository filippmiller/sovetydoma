export const dynamicParams = false
export const revalidate = false

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Breadcrumb from '@/components/Breadcrumb'
import { PERSONAS, getPersona, resolvePersona } from '@/lib/personas'
import { getAllArticles, CATEGORIES } from '@/lib/articles'
import type { AnswerRow, QuestionRow } from '@/lib/questions'
import questionsIndex from '@/lib/questions-index.json'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://1001sovet.ru').replace(/\/+$/, '')

type QWithAnswers = QuestionRow & { answers: AnswerRow[] }
const QUESTIONS = questionsIndex as unknown as QWithAnswers[]

interface Props { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const p = getPersona(slug)
  if (!p) return { title: 'Автор' }
  return {
    title: p.name,
    description: p.bio,
    alternates: { canonical: `${SITE_URL}/author/${slug}/` },
    openGraph: { title: p.name, description: p.bio, type: 'profile', url: `${SITE_URL}/author/${slug}/` },
  }
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params
  const persona = getPersona(slug)
  if (!persona) notFound()

  // Articles attributed to this persona = explicit author frontmatter OR
  // (no explicit author and this persona curates the article's category).
  const articles = getAllArticles().filter((a) => resolvePersona({ author: a.author, category: a.category }).slug === slug)

  // Questions this persona has answered (from the build-time index).
  const answered = QUESTIONS.filter((q) => (q.answers || []).some((ans) => ans.author_persona === slug))

  const authorUrl = `${SITE_URL}/author/${slug}/`
  const profileJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: persona.name,
      url: authorUrl,
      jobTitle: persona.role,
      description: persona.bio,
      email: persona.contact,
      knowsAbout: persona.categories.map((c) => CATEGORIES[c]?.name || c),
      worksFor: { '@type': 'Organization', name: 'СоветыДома', url: SITE_URL },
    },
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd) }} />
      <Breadcrumb items={[{ name: 'Авторы' }, { name: persona.name }]} />

      {/* Header */}
      <div style={{ display: 'flex', gap: '1.1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div aria-hidden="true" style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0, background: '#fff',
          border: '1px solid #eadfce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
        }}>{persona.icon}</div>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.2rem' }}>
            {persona.name}
          </h1>
          <div style={{ fontSize: '0.9rem', color: '#777' }}>{persona.role}</div>
        </div>
      </div>

      <p style={{ fontSize: '1rem', color: '#333', lineHeight: 1.7, margin: '0 0 1rem' }}>{persona.bio}</p>

      <div style={{ background: '#fbf7f2', border: '1px solid #ece3d8', borderRadius: '10px', padding: '0.9rem 1.1rem', fontSize: '0.9rem', color: '#5f5143', marginBottom: '1.75rem' }}>
        Почта редактора: <a href={`mailto:${persona.contact}`} style={{ color: '#c0392b', fontWeight: 700, textDecoration: 'none' }}>{persona.contact}</a>
      </div>

      {/* Categories */}
      <h2 style={hStyle}>Разделы</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.75rem' }}>
        {persona.categories.map((c) => {
          const cat = CATEGORIES[c]
          return (
            <Link key={c} href={`/${c}/`} style={pill}>{cat?.name || c}</Link>
          )
        })}
      </div>

      {/* Articles */}
      <h2 style={hStyle}>Статьи ({articles.length})</h2>
      {articles.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {articles.map((a) => (
            <li key={a.slug}>
              <Link href={`/${a.category}/${a.slug}/`} style={{ color: '#c0392b', fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem' }}>
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#999', marginBottom: '1.75rem' }}>Пока нет статей.</p>
      )}

      {/* Questions answered */}
      <h2 style={hStyle}>Ответы на вопросы ({answered.length})</h2>
      {answered.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {answered.map((q) => (
            <li key={q.id}>
              <Link href={`/q/${q.slug}/`} style={{ color: '#c0392b', fontWeight: 600, textDecoration: 'none', fontSize: '0.95rem' }}>
                {q.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#999', margin: 0 }}>Пока нет ответов.</p>
      )}
    </div>
  )
}

const hStyle: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.75rem' }
const pill: React.CSSProperties = {
  padding: '0.3rem 0.85rem', borderRadius: '999px', background: '#faf9f7', border: '1px solid #e0dbd5',
  color: '#555', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
}
