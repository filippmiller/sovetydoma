import type { Env } from '../types'
import type { ProviderSendResult } from './registry'

export type EmailSendInput = {
  to: string | string[]
  subject: string
  text: string
  html?: string
  replyTo?: string
  listUnsubscribe?: string | string[]
}

const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

export async function sendEmail(env: Env, input: EmailSendInput): Promise<ProviderSendResult> {
  if (!String(env.RESEND_API_KEY ?? '').trim() || !String(env.EMAIL_FROM ?? '').trim()) {
    return { ok: false, error: 'provider_unconfigured' }
  }
  if (!String(input.subject ?? '').trim() || !String(input.text ?? '').trim() || !String(input.to ?? '').trim()) {
    return { ok: false, error: 'invalid_request', details: 'Missing email subject, text, or recipient' }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${String(env.RESEND_API_KEY).trim()}`,
    'Content-Type': 'application/json',
  }
  const listUnsubscribe = normalizeListUnsubscribe(input.listUnsubscribe)
  const payload: Record<string, unknown> = {
    from: String(env.EMAIL_FROM).trim(),
    to: Array.isArray(input.to) ? input.to : [input.to],
    subject: input.subject,
    text: input.text,
  }

  if (input.html) payload.html = input.html
  if (input.replyTo) payload.reply_to = input.replyTo
  if (listUnsubscribe) payload.headers = {
    'List-Unsubscribe': listUnsubscribe,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers,
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

  const data = await response.json().catch(() => null) as { id?: string } | null
  return { ok: true, provider: 'email', status: response.status, id: data?.id }
}

function normalizeListUnsubscribe(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined
  const parts = Array.isArray(value) ? value : [value]
  const urls = parts.map((part) => String(part).trim()).filter(Boolean)
  if (urls.length === 0) return undefined
  return urls.map((url) => (url.startsWith('<') ? url : `<${url}>`)).join(', ')
}

async function readResponseText(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '')
  const trimmed = text.trim()
  return trimmed ? trimmed.slice(0, 500) : undefined
}
