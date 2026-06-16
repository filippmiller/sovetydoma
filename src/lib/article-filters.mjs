/**
 * Parse a human-readable time string into an approximate minute count.
 * Supports "15 мин", "1 час", "1,5 ч", "2–3 часа".
 *
 * @param {string} [time]
 * @returns {number | null}
 */
export function parseTimeMinutes(time) {
  if (!time) return null
  const t = time.toLowerCase()

  const hourRange = /(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*ч/i.exec(t)
  if (hourRange) {
    const avg = (Number.parseFloat(hourRange[1].replace(',', '.')) + Number.parseFloat(hourRange[2].replace(',', '.'))) / 2
    return Math.round(avg * 60)
  }

  const hours = /(\d+(?:[.,]\d+)?)\s*ч/i.exec(t)
  if (hours) {
    return Math.round(Number.parseFloat(hours[1].replace(',', '.')) * 60)
  }

  const minutes = /(\d+)\s*мин/i.exec(t)
  if (minutes) return Number.parseInt(minutes[1], 10)

  return null
}

/**
 * Parse a human-readable cost string into a numeric ruble value.
 *
 * @param {string} [cost]
 * @returns {number | null}
 */
export function parseCostRubles(cost) {
  if (!cost) return null
  const c = cost.toLowerCase()
  if (c.includes('бесплатно')) return 0
  const normalized = c.replace(/\s/g, '')
  const match = /(\d+)/.exec(normalized)
  if (!match) return null
  const value = Number.parseInt(match[1], 10)
  return value === 0 ? 0 : value
}

export function matchesDifficulty(article, filter) {
  if (!filter) return true
  return article.difficulty === filter
}

export function matchesTime(article, filter) {
  if (!filter) return true
  const minutes = parseTimeMinutes(article.time)
  if (minutes === null) return false
  switch (filter) {
    case 'short':
      return minutes <= 15
    case 'medium':
      return minutes > 15 && minutes <= 60
    case 'long':
      return minutes > 60 && minutes <= 180
    case 'verylong':
      return minutes > 180
    default:
      return true
  }
}

export function matchesCost(article, filter) {
  if (!filter) return true
  const rubles = parseCostRubles(article.cost)
  if (rubles === null) return false
  switch (filter) {
    case 'free':
      return rubles === 0
    case 'cheap':
      return rubles > 0 && rubles <= 500
    case 'medium':
      return rubles > 500 && rubles <= 1500
    case 'expensive':
      return rubles > 1500
    default:
      return true
  }
}
