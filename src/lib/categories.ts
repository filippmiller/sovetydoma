// Client-safe: no fs/path/gray-matter — can be imported from Client Components.
import { CATEGORIES as CATEGORY_DATA, SUBCATEGORIES as SUBCATEGORY_DATA, getSubcategoriesFor as _getSubcategoriesFor, getParentCategory as _getParentCategory } from './categories.mjs'

export const CATEGORIES = CATEGORY_DATA as Record<string, { name: string; slug: string; description: string }>

export interface SubcategoryEntry {
  name: string
  slug: string
  parentSlug: string
  description: string
}

export const SUBCATEGORIES = SUBCATEGORY_DATA as Record<string, SubcategoryEntry>

export function getSubcategoriesFor(parentSlug: string): SubcategoryEntry[] {
  return _getSubcategoriesFor(parentSlug)
}

export function getParentCategory(subSlug: string): { name: string; slug: string; description: string } | null {
  return _getParentCategory(subSlug)
}
