export type Tone = 'light' | 'dark'
export type SubmitStatus = 'idle' | 'success' | 'warning' | 'error'

export const DIRECT_CHANNELS = [
  { key: 'email', label: 'Email', helper: 'Письмо с подборкой' },
  { key: 'telegram', label: 'Telegram', helper: 'Откроем бота для подтверждения' },
  { key: 'max', label: 'MAX', helper: 'Подтверждение через бот' },
  { key: 'whatsapp', label: 'WhatsApp', helper: 'Нужен номер телефона' },
  { key: 'sms', label: 'SMS', helper: 'Нужен номер телефона' },
] as const

export function formatChannelLabel(channel: string) {
  const entry = DIRECT_CHANNELS.find((item) => item.key === channel)
  return entry?.label ?? channel
}

export type ChannelResult = {
  status?: string
  action?: string
  url?: string
  message?: string
}

export function bannerColors(tone: Tone, status: SubmitStatus) {
  const palette = tone === 'dark'
    ? {
        baseBg: '#303030',
        baseBorder: '#454545',
        baseText: '#f0ede8',
        baseMuted: '#c0bdb8',
        fieldBg: '#3a3a3a',
        fieldBorder: '#555',
        fieldText: '#eee',
        chipBg: '#3a3a3a',
        chipBorder: '#555',
        chipText: '#eee',
      }
    : {
        baseBg: '#fff',
        baseBorder: '#e8e4df',
        baseText: '#1a1a1a',
        baseMuted: '#666',
        fieldBg: '#fff',
        fieldBorder: '#ddd',
        fieldText: '#1a1a1a',
        chipBg: '#f5f3f0',
        chipBorder: '#ddd',
        chipText: '#2c2c2c',
      }

  const accent = status === 'success'
    ? { bg: tone === 'dark' ? '#12331f' : '#e9f7ef', border: tone === 'dark' ? '#1f5f37' : '#a9dfbf', text: tone === 'dark' ? '#bff0cd' : '#1e7b44' }
    : status === 'warning'
      ? { bg: tone === 'dark' ? '#3d2f15' : '#fff5dd', border: tone === 'dark' ? '#7a5c20' : '#f0d89a', text: tone === 'dark' ? '#ffdf99' : '#8f5f00' }
      : status === 'error'
        ? { bg: tone === 'dark' ? '#3a1e1e' : '#fdecea', border: tone === 'dark' ? '#7a3a3a' : '#f5c2c7', text: tone === 'dark' ? '#ffb3b3' : '#a12c2c' }
        : null

  return { ...palette, accent }
}
