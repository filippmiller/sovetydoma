// Reading time estimator (Russian: ~180 words/min)
export function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / 180))
  if (minutes === 1) return '1 минута'
  if (minutes < 5) return `${minutes} минуты`
  return `${minutes} минут`
}

// Relative date in Russian
export function relativeDate(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'сегодня'
  if (diffDays === 1) return 'вчера'
  if (diffDays < 7) return `${diffDays} дн. назад`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return weeks === 1 ? '1 неделю назад' : `${weeks} нед. назад`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    if (months === 1) return '1 месяц назад'
    if (months < 5) return `${months} месяца назад`
    return `${months} месяцев назад`
  }
  const years = Math.floor(diffDays / 365)
  return years === 1 ? '1 год назад' : `${years} года назад`
}

// Full date in Russian
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Count words in MDX content (strips frontmatter + markdown syntax)
export function countWords(content: string): number {
  return content
    .replace(/^---[\s\S]+?---/, '')
    .replace(/[#*`\[\]()>]/g, '')
    .trim()
    .split(/\s+/).length
}

// Category emoji map
export const CATEGORY_EMOJI: Record<string, string> = {
  kulinaria: '🍲',
  'dom-i-uborka': '🧹',
  'dacha-i-ogorod': '🌱',
  layfkhaki: '💡',
  ekonomiya: '💰',
}

// Category color map
export const CATEGORY_COLOR: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
}
