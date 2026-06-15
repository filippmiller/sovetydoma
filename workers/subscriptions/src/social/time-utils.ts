/**
 * Moscow-time posting-hours helpers shared by vk-autopost.ts and fb-autopost.ts.
 */

export const MOSCOW_DAY_START = 9
export const MOSCOW_DAY_END = 21

export function getMoscowHour(now: Date): number {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Moscow',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(now).find((part) => part.type === 'hour')?.value
    return Number(hour)
  } catch {
    return now.getUTCHours() + 3 // rough Moscow fallback
  }
}

export function isWithinPostingHours(now: Date): boolean {
  const hour = getMoscowHour(now)
  return hour >= MOSCOW_DAY_START && hour < MOSCOW_DAY_END
}
