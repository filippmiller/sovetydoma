export const SUBSCRIPTION_CATEGORY_SLUGS = [
  'kulinaria',
  'dom-i-uborka',
  'dacha-i-ogorod',
  'layfkhaki',
  'ekonomiya',
  'rybalka',
  'zdorovie-i-bezopasnost',
  'semya-i-deti',
  'krasota-i-uhod',
  'otdyh-i-puteshestviya',
  'pokupki-i-tehnika',
  'avto',
]

export const DIRECT_NOTIFICATION_CHANNELS = [
  'email',
  'telegram',
  'max',
  'whatsapp',
  'sms',
]

export const SOCIAL_FOLLOW_TARGETS = [
  'vk',
  'ok',
  'facebook',
]

export const FREQUENCY_PRESETS = {
  daily_one: {
    maxMessagesPerPeriod: 1,
    maxArticlesPerMessage: 1,
    period: 'day',
  },
  daily_digest_3: {
    maxMessagesPerPeriod: 1,
    maxArticlesPerMessage: 3,
    period: 'day',
  },
  weekly_digest_3: {
    maxMessagesPerPeriod: 1,
    maxArticlesPerMessage: 3,
    period: 'week',
  },
  weekly_digest_7: {
    maxMessagesPerPeriod: 1,
    maxArticlesPerMessage: 7,
    period: 'week',
  },
}

export const DEFAULT_SUBSCRIPTION_FREQUENCY = 'weekly_digest_3'
