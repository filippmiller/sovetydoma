import type { Env } from '../types'
import type { ProviderSendResult } from './registry'

export type TelegramSendInput = {
  chatId: string | number
  text: string
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  disableWebPagePreview?: boolean
  disableNotification?: boolean
}

const TELEGRAM_SEND_MESSAGE_URL = (token: string) => `https://api.telegram.org/bot${token}/sendMessage`

export async function sendTelegramMessage(env: Env, input: TelegramSendInput): Promise<ProviderSendResult> {
  if (!String(env.TELEGRAM_BOT_TOKEN ?? '').trim()) {
    return { ok: false, error: 'provider_unconfigured' }
  }
  if (!String(input.text ?? '').trim() || input.chatId === '' || input.chatId === null || input.chatId === undefined) {
    return { ok: false, error: 'invalid_request', details: 'Missing Telegram chatId or text' }
  }

  const payload: Record<string, unknown> = {
    chat_id: input.chatId,
    text: input.text,
  }

  if (input.parseMode) payload.parse_mode = input.parseMode
  if (typeof input.disableWebPagePreview === 'boolean') payload.disable_web_page_preview = input.disableWebPagePreview
  if (typeof input.disableNotification === 'boolean') payload.disable_notification = input.disableNotification

  const response = await fetch(TELEGRAM_SEND_MESSAGE_URL(String(env.TELEGRAM_BOT_TOKEN).trim()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    return {
      ok: false,
      error: 'provider_error',
      status: response.status,
      details: await readResponseText(response),
    }
  }

  const data = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number } } | null
  return {
    ok: true,
    provider: 'telegram',
    status: response.status,
    id: data?.result?.message_id === undefined ? undefined : String(data.result.message_id),
  }
}

async function readResponseText(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '')
  const trimmed = text.trim()
  return trimmed ? trimmed.slice(0, 500) : undefined
}
