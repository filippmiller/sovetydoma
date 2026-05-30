export const dynamicParams = false
export const revalidate = false

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Breadcrumb from '@/components/Breadcrumb'
import QuestionAnswers from '@/components/QuestionAnswers'
import { getArticleMeta } from '@/lib/article-index'
import type { AnswerRow, QuestionRow } from '@/lib/questions'
import questionsIndex from '@/lib/questions-index.json'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://sovetydoma.vercel.app').replace(/\/+$/, '')

type QWithAnswers = QuestionRow & { answers: AnswerRow[] }
const ALL = questionsIndex as unknown as QWithAnswers[]

interface Props { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  // `output: export` requires a non-empty param set for a dynamic route, so
  // when there are no approved questions yet we emit a sentinel slug that the
  // page renders as notFound(). Real questions replace it once they exist.
  if (ALL.length === 0) return [{ slug: '__none__' }]
  return ALL.map((q) => ({ slug: q.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const q = ALL.find((x) => x.slug === slug)
  if (!q) return { title: 'Вопрос' }
  const desc = (q.body || q.title).slice(0, 160)
  return {
    title: `${q.title} — Вопросы | СоветыДома`,
    description: desc,
    alternates: { canonical: `${SITE_URL}/q/${slug}/` },
    openGraph: { title: q.title, description: desc, type: 'article', url: `${SITE_URL}/q/${slug}/` },
  }
}

export default async function QuestionPage({ params }: Props) {
  const { slug } = await params
  const q = ALL.find((x) => x.slug === slug)
  if (!q) notFound()

  const article = getArticleMeta(q.article_slug)
  const articleHref = article ? `/${article.category}/${q.article_slug}/` : null

  // QAPage JSON-LD for rich results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: q.title,
      text: q.body || q.title,
      answerCount: q.answers.length,
      dateCreated: q.created_at,
      ...(q.answers.length > 0
        ? {
            acceptedAnswer: {
              '@type': 'Answer',
              text: q.answers[0].body,
              dateCreated: q.answers[0].created_at,
            },
            suggestedAnswer: q.answers.map((a) => ({ '@type': 'Answer', text: a.body, dateCreated: a.created_at })),
          }
        : {}),
    },
  }

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Breadcrumb items={[{ name: 'Вопросы' }, { name: q.title }]} />

      <h1 style={{ fontSize: '1.7rem', fontWeight: 800, color: '#1a1a1a', lineHeight: 1.3, margin: '0 0 0.75rem' }}>{q.title}</h1>
      {q.body && <p style={{ fontSize: '1.02rem', color: '#444', lineHeight: 1.65, margin: '0 0 0.75rem' }}>{q.body}</p>}
      <div style={{ fontSize: '0.82rem', color: '#aaa', marginBottom: '0.5rem' }}>Спросил(а): {q.author_name}</div>

      {articleHref && article && (
        <div style={{ background: '#fbf7f2', border: '1px solid #ece3d8', borderRadius: '10px', padding: '0.8rem 1rem', margin: '1rem 0' }}>
          <span style={{ fontSize: '0.8rem', color: '#8a8378' }}>По статье: </span>
          <Link href={articleHref} style={{ color: '#c0392b', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            {article.title}
          </Link>
        </div>
      )}

      <QuestionAnswers questionId={q.id} initialAnswers={q.answers || []} />
    </div>
  )
}
