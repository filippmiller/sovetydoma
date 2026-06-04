// Client-safe: no fs/path/gray-matter — can be imported from Client Components.
import { CATEGORIES as CATEGORY_DATA } from './categories.mjs'

export const CATEGORIES = CATEGORY_DATA as Record<string, { name: string; slug: string; description: string }>
