'use client'

import type { ArticleFrontmatter } from '@/lib/articles'

interface Props {
  fm: ArticleFrontmatter
  content: string
}

interface Heading {
  id: string
  text: string
}

function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
}

function extractActionHeadings(content: string): Heading[] {
  return content
    .split('\n')
    .map((line) => line.match(/^##\s+(.+)/)?.[1]?.trim())
    .filter((text): text is string => Boolean(text))
    .filter((text) => !/^(итог|вывод|частые вопросы|faq|заключение)$/i.test(text))
    .slice(0, 4)
    .map((text) => ({ id: headingId(text), text }))
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0]?.trim() || text
}

export default function ArticleActionSummary({ fm, content }: Props) {
  const steps = extractActionHeadings(content)
  const intro = (fm.quickAnswer && firstSentence(fm.quickAnswer)) || firstSentence(fm.description || '')
  const needs = (fm.needs && fm.needs.length ? fm.needs : fm.recipeIngredient) || []

  if (!intro && steps.length === 0 && needs.length === 0) return null

  return (
    <aside className="article-action-summary" aria-label="С чего начать">
      <div className="article-action-summary-heading">
        <span>С чего начать</span>
        {(fm.time || fm.difficulty) && (
          <small>
            {fm.time ? fm.time : ''}
            {fm.time && fm.difficulty ? ' · ' : ''}
            {fm.difficulty ? fm.difficulty : ''}
          </small>
        )}
      </div>

      {intro && <p>{intro}</p>}

      {steps.length > 0 && (
        <ol>
          {steps.map((step) => (
            <li key={step.id}>
              <a href={`#${step.id}`}>{step.text}</a>
            </li>
          ))}
        </ol>
      )}

      {needs.length > 0 && (
        <div className="article-action-summary-needs">
          <strong>Подготовьте:</strong> {needs.slice(0, 8).join(', ')}
        </div>
      )}

      <style jsx>{`
        .article-action-summary {
          display: grid;
          gap: 0.75rem;
          margin: 0 0 1.5rem;
          padding: 1rem;
          border: 1px solid #e8ded4;
          border-left: 4px solid #16a085;
          border-radius: 8px;
          background: #fbf8f4;
        }
        .article-action-summary-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .article-action-summary-heading span {
          color: #222;
          font-size: 1rem;
          font-weight: 800;
        }
        .article-action-summary-heading small {
          color: #8a8378;
          font-size: 0.78rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .article-action-summary p {
          color: #444;
          line-height: 1.55;
          margin: 0;
        }
        .article-action-summary ol {
          counter-reset: action-step;
          display: grid;
          gap: 0.45rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .article-action-summary li {
          counter-increment: action-step;
        }
        .article-action-summary a {
          display: grid;
          grid-template-columns: 1.6rem minmax(0, 1fr);
          gap: 0.45rem;
          align-items: start;
          color: #1f1f1f;
          text-decoration: none;
          font-size: 0.92rem;
          font-weight: 700;
          line-height: 1.4;
        }
        .article-action-summary a::before {
          content: counter(action-step);
          display: inline-grid;
          place-items: center;
          width: 1.45rem;
          height: 1.45rem;
          border-radius: 50%;
          background: #16a08518;
          color: #13856f;
          font-size: 0.78rem;
          font-weight: 800;
        }
        .article-action-summary a:hover {
          color: #c0392b;
        }
        .article-action-summary-needs {
          color: #5d554f;
          font-size: 0.86rem;
          line-height: 1.45;
          padding-top: 0.2rem;
        }
        @media (max-width: 560px) {
          .article-action-summary-heading {
            display: grid;
          }
          .article-action-summary-heading small {
            white-space: normal;
          }
        }
      `}</style>
    </aside>
  )
}
