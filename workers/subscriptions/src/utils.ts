/**
 * Pure string-manipulation utilities shared across the subscriptions worker.
 */

export function normalizeList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
}

export function cleanPath(value: unknown): string {
  const path = String(value || '/').trim().replace(/[\r\n]/g, '').slice(0, 500)
  return path.startsWith('/') ? path : '/'
}

export function cleanTimezone(value: unknown): string {
  return String(value || 'Europe/Moscow').trim().replace(/[^A-Za-z0-9_+\-/]/g, '').slice(0, 80) || 'Europe/Moscow'
}

export function normalizePhone(value: unknown): string {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 32)
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char))
}
