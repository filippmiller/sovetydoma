import type { Env } from '../types'
import type { ProviderSendResult } from './registry'

export type WhatsAppTemplateParameter = {
  type: 'text'
  text: string
}

export type WhatsAppTemplateComponent = {
  type: 'body'
  parameters?: WhatsAppTemplateParameter[]
}

export type WhatsAppSendInput = {
  to: string
  templateName: string
  languageCode: string
  components?: WhatsAppTemplateComponent[]
}

const WHATSAPP_MESSAGES_URL = (phoneNumberId: string) =>
  `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`

export async function sendWhatsAppTemplate(env: Env, input: WhatsAppSendInput): Promise<ProviderSendResult> {
  if (!String(env.WHATSAPP_ACCESS_TOKEN ?? '').trim() || !String(env.WHATSAPP_PHONE_NUMBER_ID ?? '').trim()) {
    return { ok: false, error: 'provider_unconfigured' }
  }
  if (!String(input.to ?? '').trim() || !String(input.templateName ?? '').trim() || !String(input.languageCode ?? '').trim()) {
    return { ok: false, error: 'invalid_request', details: 'Missing WhatsApp recipient, templateName, or languageCode' }
  }

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.languageCode },
    },
  }

  if (input.components && input.components.length > 0) {
    payload.template = {
      ...payload.template,
      components: input.components,
    }
  }

  const response = await fetch(WHATSAPP_MESSAGES_URL(String(env.WHATSAPP_PHONE_NUMBER_ID).trim()), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${String(env.WHATSAPP_ACCESS_TOKEN).trim()}`,
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

  const data = await response.json().catch(() => null) as { messages?: Array<{ id?: string }> } | null
  return {
    ok: true,
    provider: 'whatsapp',
    status: response.status,
    id: data?.messages?.[0]?.id,
  }
}

async function readResponseText(response: Response): Promise<string | undefined> {
  const text = await response.text().catch(() => '')
  const trimmed = text.trim()
  return trimmed ? trimmed.slice(0, 500) : undefined
}
