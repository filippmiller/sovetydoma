import {
  DEFAULT_SUBSCRIPTION_FREQUENCY,
  DIRECT_NOTIFICATION_CHANNELS,
  FREQUENCY_PRESETS,
  SUBSCRIPTION_CATEGORY_SLUGS,
} from './constants.mjs'

const categorySet = new Set(SUBSCRIPTION_CATEGORY_SLUGS)
const channelSet = new Set(DIRECT_NOTIFICATION_CHANNELS)
const frequencySet = new Set(Object.keys(FREQUENCY_PRESETS))
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function uniqueKnownList(values, allowed) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map(String).filter((value) => allowed.has(value)))]
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').slice(0, 32)
}

export function normalizeSubscriptionRequest(input) {
  const frequency = String(input?.frequency || '')

  return {
    categories: uniqueKnownList(input?.categories, categorySet),
    channels: uniqueKnownList(input?.channels, channelSet),
    frequency: frequencySet.has(frequency) ? frequency : DEFAULT_SUBSCRIPTION_FREQUENCY,
    contacts: {
      email: String(input?.contacts?.email || '').trim().toLowerCase(),
      phone: normalizePhone(input?.contacts?.phone),
      telegramStartToken: String(input?.contacts?.telegramStartToken || '').trim(),
      maxStartToken: String(input?.contacts?.maxStartToken || '').trim(),
      whatsappOptInToken: String(input?.contacts?.whatsappOptInToken || '').trim(),
    },
    consent: input?.consent === true,
    advertisingConsent: input?.advertisingConsent === true,
    sourcePath: String(input?.sourcePath || '/'),
    timezone: String(input?.timezone || 'Europe/Moscow'),
    turnstileToken: String(input?.turnstileToken || ''),
  }
}

export function validateSubscriptionRequest(input) {
  const request = normalizeSubscriptionRequest(input)
  const errors = {}

  if (request.categories.length === 0) {
    errors.categories = 'Выберите хотя бы одну категорию'
  }
  if (request.channels.length === 0) {
    errors.channels = 'Выберите хотя бы один канал'
  }
  if (!request.consent) {
    errors.consent = 'Подтвердите согласие на уведомления'
  }
  if (request.channels.includes('email') && !emailPattern.test(request.contacts.email)) {
    errors.email = 'Укажите корректный email'
  }
  if (request.channels.includes('whatsapp') && request.contacts.phone.length < 10) {
    errors.whatsapp = 'Укажите телефон для WhatsApp'
  }
  if (request.channels.includes('sms') && request.contacts.phone.length < 10) {
    errors.sms = 'Укажите телефон для SMS'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    request,
  }
}
