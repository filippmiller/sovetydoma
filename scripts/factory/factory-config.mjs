// factory-config.mjs — shared, dependency-free constants for the content factory.
// MUST stay importable before `pnpm install` (the workflow's pause gate runs
// this before dependency install), so no @anthropic-ai/sdk / supabase imports.

export const DOMAIN = '1001sovet.ru'

// Explicit provider registry. There is NO fallback text provider by design:
// an unknown FACTORY_TEXT_PROVIDER is rejected before any API/DB work.
export const SUPPORTED_TEXT_PROVIDERS = ['anthropic']
export const DEFAULT_TEXT_PROVIDER = 'anthropic'
export const IMAGE_PROVIDER = 'fal'
export const DEFAULT_TEXT_MODEL = 'claude-sonnet-4-6'
export const DEFAULT_FAL_MODEL = 'fal-ai/flux/schnell'

// Category slug -> human name + persona voice. Mirrors src/lib/categories + personas.
export const CATEGORIES = {
  'kulinaria': 'Кулинария',
  'dom-i-uborka': 'Дом и уборка',
  'dacha-i-ogorod': 'Дача и огород',
  'layfkhaki': 'Лайфхаки',
  'ekonomiya': 'Экономия',
  'rybalka': 'Рыбалка',
  'zdorovie-i-bezopasnost': 'Здоровье и безопасность',
  'semya-i-deti': 'Семья и дети',
  'krasota-i-uhod': 'Красота и уход',
  'otdyh-i-puteshestviya': 'Отдых и путешествия',
  'pokupki-i-tehnika': 'Покупки и техника',
  'avto': 'Авто',
}

// Weighted rotation: kulinaria + dacha-i-ogorod appear 3x each (priority
// verticals per owner request 2026-07-20), the other 10 once. Interleaved so
// the same category never runs back-to-back. 16 slots total.
export const ROTATION_SLOTS = [
  'kulinaria', 'dacha-i-ogorod', 'dom-i-uborka', 'kulinaria',
  'dacha-i-ogorod', 'layfkhaki', 'ekonomiya', 'kulinaria',
  'dacha-i-ogorod', 'rybalka', 'zdorovie-i-bezopasnost', 'semya-i-deti',
  'krasota-i-uhod', 'otdyh-i-puteshestviya', 'pokupki-i-tehnika', 'avto',
]

export function rotateCategory(epochSeconds) {
  return ROTATION_SLOTS[Math.floor(epochSeconds / 18000) % ROTATION_SLOTS.length]
}
