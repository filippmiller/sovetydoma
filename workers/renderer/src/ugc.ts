export interface DynamicQuestion {
  slug: string
  title: string
  answers_count: number | null
}

export interface DynamicComment {
  id: string
  content: string
  parent_id: string | null
  created_at: string
  profiles?: { display_name?: string | null } | Array<{ display_name?: string | null }> | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pluralAnswers(value: number): string {
  const m10 = value % 10
  const m100 = value % 100
  if (m10 === 1 && m100 !== 11) return 'ответ'
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'ответа'
  return 'ответов'
}

function emptyState(icon: string, text: string): string {
  return `<div style="text-align:center;color:#777;background:#faf9f7;border:1.5px dashed #e8e4df;border-radius:12px;padding:1.75rem 1rem"><div style="font-size:1.6rem;margin-bottom:0.4rem">${icon}</div><p style="margin:0;font-size:0.92rem">${escapeHtml(text)}</p></div>`
}

export function buildQuestionsHtml(rows: DynamicQuestion[] | null): string {
  const heading = '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:1rem"><h2 style="margin:0;font-size:1.2rem;font-weight:800;color:#1a1a1a">❓ Вопросы по статье</h2></div>'
  if (rows === null) {
    return heading + emptyState('🕓', 'Вопросы временно недоступны. Попробуйте обновить страницу позже.')
  }
  if (rows.length === 0) {
    return heading + emptyState('💬', 'Пока вопросов нет.')
  }
  const items = rows.map((row) => {
    const count = Math.max(0, row.answers_count ?? 0)
    const meta = count > 0 ? `💬 ${count} ${pluralAnswers(count)}` : 'Пока без ответа'
    return `<a href="/q/${encodeURIComponent(row.slug)}/" style="text-decoration:none"><div style="background:#faf9f7;border:1px solid #ede9e4;border-radius:10px;padding:0.9rem 1.1rem"><div style="font-weight:700;color:#1a1a1a;font-size:0.95rem">${escapeHtml(row.title)}</div><div style="font-size:0.78rem;color:#888;margin-top:0.3rem">${meta}</div></div></a>`
  }).join('')
  return `${heading}<div style="display:flex;flex-direction:column;gap:0.75rem">${items}</div>`
}

function commentAuthor(row: DynamicComment): string {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  const name = profile?.display_name?.trim()
  return name || 'Читатель'
}

export function buildCommentsHtml(rows: DynamicComment[] | null): string {
  const count = rows?.length ?? 0
  const countBadge = rows === null ? '' : `<span style="background:#f0ede8;color:#666;border-radius:999px;font-size:0.78rem;font-weight:700;padding:0.15rem 0.6rem;line-height:1.5">${count}</span>`
  const heading = `<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:1.25rem"><h2 style="margin:0;font-size:1.2rem;font-weight:800;color:#1a1a1a">💬 Комментарии</h2>${countBadge}</div>`
  if (rows === null) {
    return heading + emptyState('🕓', 'Комментарии временно недоступны. Попробуйте обновить страницу позже.')
  }
  if (rows.length === 0) {
    return heading + emptyState('💭', 'Комментариев пока нет.')
  }
  const items = rows.map((row) => {
    const isReply = Boolean(row.parent_id)
    const date = new Date(row.created_at)
    const formatted = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    return `<article style="${isReply ? 'margin-left:2rem;border-left:3px solid #eee;padding-left:1rem;' : ''}border-bottom:1px solid #f0ede8;padding-bottom:0.9rem"><div style="font-size:0.82rem;font-weight:700;color:#1a1a1a">${escapeHtml(commentAuthor(row))}</div>${formatted ? `<div style="font-size:0.72rem;color:#888;margin-top:0.15rem">${escapeHtml(formatted)}</div>` : ''}<p style="margin:0.45rem 0 0;color:#333;font-size:0.93rem;line-height:1.65;white-space:pre-wrap">${escapeHtml(row.content)}</p></article>`
  }).join('')
  return `${heading}<div style="display:flex;flex-direction:column;gap:1rem">${items}</div>`
}
