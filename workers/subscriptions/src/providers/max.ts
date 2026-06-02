import type { Env } from '../types'
import type { ProviderSendResult } from './registry'

export type MaxSendInput = {
  chatId: string | number
  text: string
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
}

const MAX_SEND_MESSAGE_PATH = 'messages'

export async function sendMaxMessage(env: Env, input: MaxSendInput): Promise<ProviderSendResult> {
  if (!String(env.MAX_BOT_TOKEN ?? '').trim() || !String(env.MAX_API_BASE_URL ?? '').trim()) {
    return { ok: false, error: 'provider_unconfigured' }
  }
  if (!String(input.text ?? '').trim() || input.chatId === '' || input.chatId === null || input.chatId === undefined) {
    return { ok: false, error: 'invalid_request', details: 'Missing MAX chatId or text' }
  }

  const url = new URL(MAX_SEND_MESSAGE_PATH, String(env.MAX_API_BASE_URL).trim())
  url.searchParams.set('chat_id', String(input.chatId))
  const payload: Record<string, unknown> = {
    text: input.text,
  }
  if (input.parseMode) payload.parse_mode = input.parseMode

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: String(env.MAX_BOT_TOKEN).trim(),
      'Content-Type': 'application/json',
    },
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

  const data = await response.json().catch(() => null) as { message_id?: string | number; id?: string | number } | null
  const id = data?.id ?? data?.message_id
  return { ok: true, provider: 'max', status: response.status, id: id === undefined ? undefined : String(id) }
}

async function readResponseText(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '')
  const trimmed = text.trim()
  return trimmed ? trimmed.slice(0, 500) : undefined
}
