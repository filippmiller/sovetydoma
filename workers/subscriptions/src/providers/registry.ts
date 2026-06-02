import type { Env, ProviderReadinessMap } from '../types'
import { sendEmail, type EmailSendInput } from './email'
import { sendMaxMessage, type MaxSendInput } from './max'
import { sendSms, type SmsSendInput } from './sms'
import { sendTelegramMessage, type TelegramSendInput } from './telegram'
import { sendWhatsAppTemplate, type WhatsAppSendInput } from './whatsapp'

const PROVIDER_ENV_VARS: Record<keyof ProviderReadinessMap, string[]> = {
  email: ['RESEND_API_KEY', 'EMAIL_FROM'],
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME'],
  max: ['MAX_BOT_TOKEN', 'MAX_BOT_USERNAME', 'MAX_API_BASE_URL'],
  whatsapp: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_TEMPLATE_CONFIRMATION'],
  sms: ['SMS_API_KEY', 'SMS_FROM', 'SMS_PROVIDER_BASE_URL'],
}

export type ProviderSendError = {
  ok: false
  error: 'provider_unconfigured' | 'invalid_request' | 'provider_error'
  status?: number
  details?: string
}

export type ProviderSendSuccess = {
  ok: true
  provider: keyof ProviderReadinessMap
  id?: string
  status?: number
}

export type ProviderSendResult = ProviderSendSuccess | ProviderSendError

export type SendDigestToChannelInput =
  | ({ channel: 'email' } & EmailSendInput)
  | ({ channel: 'telegram' } & TelegramSendInput)
  | ({ channel: 'max' } & MaxSendInput)
  | ({ channel: 'whatsapp' } & WhatsAppSendInput)
  | ({ channel: 'sms' } & SmsSendInput)

export function getProviderReadiness(env: Env): ProviderReadinessMap {
  return Object.fromEntries(
    Object.entries(PROVIDER_ENV_VARS).map(([provider, envVars]) => {
      const missing = envVars.filter((name) => !String(env[name as keyof Env] ?? '').trim())
      return [provider, { ready: missing.length === 0, missing }]
    }),
  ) as ProviderReadinessMap
}

export async function sendDigestToChannel(env: Env, input: SendDigestToChannelInput): Promise<ProviderSendResult> {
  switch (input.channel) {
    case 'email':
      return sendEmail(env, input)
    case 'telegram':
      return sendTelegramMessage(env, input)
    case 'max':
      return sendMaxMessage(env, input)
    case 'whatsapp':
      return sendWhatsAppTemplate(env, input)
    case 'sms':
      return sendSms(env, input)
    default:
      return { ok: false, error: 'invalid_request', details: `Unsupported channel: ${(input as { channel: string }).channel}` }
  }
}
