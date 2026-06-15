export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин. назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч. назад`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} дн. назад`
  const months = Math.floor(days / 30)
  return `${months} мес. назад`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Deterministic color per user name
export const AVATAR_COLORS: [string, string][] = [
  ['#fde8e8', '#c0392b'],
  ['#e8f0fe', '#1a56db'],
  ['#e8faf0', '#1e8449'],
  ['#fef3e8', '#d35400'],
  ['#f3e8fe', '#7d3c98'],
  ['#e8f8fe', '#117a8b'],
]

export function avatarColor(name: string): [string, string] {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
