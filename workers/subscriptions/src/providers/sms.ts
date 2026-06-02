import type { Env } from '../types'
import type { ProviderSendResult } from './registry'

export type SmsSendInput = {
  to: string
  text: string
  from?: string
}

export async function sendSms(env: Env, input: SmsSendInput): Promise<ProviderSendResult> {
  if (!String(env.SMS_API_KEY ?? '').trim() || !String(env.SMS_PROVIDER_BASE_URL ?? '').trim() || !String(env.SMS_FROM ?? '').trim()) {
    return { ok: false, error: 'provider_unconfigured' }
  }
  if (!String(input.to ?? '').trim() || !String(input.text ?? '').trim()) {
    return { ok: false, error: 'invalid_request', details: 'Missing SMS recipient or text' }
  }

  const response = await fetch(String(env.SMS_PROVIDER_BASE_URL).trim(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${String(env.SMS_API_KEY).trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from ?? String(env.SMS_FROM).trim(),
      to: input.to,
      text: input.text,
    }),
  })

  if (!response.ok) {
    return {
      ok: false,
      error: 'provider_error',
      status: response.status,
      details: await readResponseText(response),
    }
  }

  const data = await response.json().catch(() => null) as { id?: string | number; message_id?: string | number } | null
  const id = data?.id ?? data?.message_id
  return { ok: true, provider: 'sms', status: response.status, id: id === undefined ? undefined : String(id) }
}

async function readResponseText(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '')
  const trimmed = text.trim()
  return trimmed ? trimmed.slice(0, 500) : undefined
}
