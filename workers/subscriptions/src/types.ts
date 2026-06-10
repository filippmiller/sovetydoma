export type DirectChannel = 'email' | 'telegram' | 'max' | 'whatsapp' | 'sms'

export type ProviderName = DirectChannel

export type ProviderReadiness = {
  ready: boolean
  missing: string[]
}

export type ProviderReadinessMap = Record<ProviderName, ProviderReadiness>

export type SubscriptionStartRequest = {
  categories?: string[]
  channels?: string[]
  contacts?: {
    email?: string
    phone?: string
    telegramStartToken?: string
    maxStartToken?: string
    whatsappOptInToken?: string
  }
  consent?: boolean
  advertisingConsent?: boolean
  frequency?: string
  sourcePath?: string
  timezone?: string
  turnstileToken?: string
}

export type Env = {
  ALLOWED_ORIGINS?: string
  SUBSCRIPTIONS_API_URL?: string
  TURNSTILE_SECRET_KEY?: string
  TURNSTILE_SITEVERIFY_URL?: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  EMAIL_REPLY_TO?: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_BOT_USERNAME?: string
  TELEGRAM_WEBHOOK_SECRET?: string
  MAX_BOT_TOKEN?: string
  MAX_BOT_USERNAME?: string
  MAX_WEBHOOK_SECRET?: string
  MAX_API_BASE_URL?: string
  WHATSAPP_ACCESS_TOKEN?: string
  WHATSAPP_PHONE_NUMBER_ID?: string
  WHATSAPP_WEBHOOK_SECRET?: string
  WHATSAPP_APP_SECRET?: string
  WHATSAPP_VERIFY_TOKEN?: string
  WHATSAPP_TEMPLATE_CONFIRMATION?: string
  WHATSAPP_TEMPLATE_DIGEST_DAILY?: string
  WHATSAPP_TEMPLATE_DIGEST_WEEKLY?: string
  WHATSAPP_TEMPLATE_LANGUAGE?: string
  RESEND_WEBHOOK_SECRET?: string
  SMS_API_KEY?: string
  SMS_FROM?: string
  SMS_PROVIDER_BASE_URL?: string
  SMS_WEBHOOK_SECRET?: string
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  PUBLIC_SITE_URL?: string
  ADMIN_API_KEY?: string
  UNSUBSCRIBE_TOKEN_SECRET?: string
  PII_HASH_SECRET?: string
  DIGEST_BATCH_SIZE?: string
  SUBSCRIPTIONS_ALLOW_UNVERIFIED_TURNSTILE?: string
  VK_ACCESS_TOKEN?: string
  VK_PHOTO_ACCESS_TOKEN?: string
  VK_GROUP_ID?: string
  VK_API_VERSION?: string
  VK_API_BASE_URL?: string
  VK_ID_APP_ID?: string
  VK_ID_CLIENT_SECRET?: string
  VK_ID_REDIRECT_URI?: string
  VK_ID_API_BASE_URL?: string
  VK_ID_AUTH_BASE_URL?: string
  YANDEX_OAUTH_CLIENT_ID?: string
  YANDEX_OAUTH_CLIENT_SECRET?: string
  VK_AUTOPOST_MAX_DAILY?: string
  FB_PAGE_ID?: string
  FB_PAGE_ACCESS_TOKEN?: string
  FB_API_VERSION?: string
  FB_API_BASE_URL?: string
  FB_AUTOPOST_MAX_DAILY?: string
  FB_PAGES_BY_CATEGORY?: string
}

export type RouteContext = {
  waitUntil(promise: Promise<unknown>): void
}
