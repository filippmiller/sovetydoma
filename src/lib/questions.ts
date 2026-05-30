// Shared types + helpers for the community Questions feature.
export interface QuestionRow {
  id: string
  slug: string
  article_slug: string
  title: string
  body: string
  user_id: string | null
  author_name: string
  status: 'pending' | 'approved' | 'rejected'
  answers_count: number
  created_at: string
  updated_at: string
}

export interface AnswerRow {
  id: string
  question_id: string
  body: string
  user_id: string | null
  author_name: string
  author_persona: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export function questionHref(slug: string): string {
  return `/q/${slug}/`
}
