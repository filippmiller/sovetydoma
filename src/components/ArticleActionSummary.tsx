import type { ArticleFrontmatter } from '@/lib/articles'
import { extractArticleHeadings } from '@/lib/heading-ids'

interface Props {
  fm: ArticleFrontmatter
  content: string
}

function extractActionHeadings(content: string) {
  return extractArticleHeadings(content)
    .filter((heading) => !/^(итог|вывод|частые вопросы|faq|заключение)$/i.test(heading.text))
    .slice(0, 4)
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
    </aside>
  )
}
