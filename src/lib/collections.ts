import { getSupabase } from './supabase'

export interface Collection {
  id: string
  owner_id: string
  name: string
  slug: string
  is_public: boolean
  created_at: string
}

export interface CollectionItem {
  collection_id: string
  article_slug: string
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function getUserCollections(
  supabaseClient?: ReturnType<typeof getSupabase>
): Promise<Collection[]> {
  const sb = supabaseClient || getSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return []

  const { data, error } = await sb
    .from('collections')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as Collection[]
}

export async function createCollection(
  sb: ReturnType<typeof getSupabase>,
  name: string
): Promise<Collection> {
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let baseSlug = slugify(name)
  if (!baseSlug) baseSlug = 'kollektsiya'

  let slug = baseSlug
  let suffix = 1
  while (true) {
    const { data: existing } = await sb
      .from('collections')
      .select('id')
      .eq('owner_id', user.id)
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break
    suffix++
    slug = `${baseSlug}-${suffix}`
  }

  const { data, error } = await sb
    .from('collections')
    .insert({ owner_id: user.id, name, slug, is_public: false })
    .select()
    .single()

  if (error) throw error
  return data as Collection
}

export async function addToCollection(
  sb: ReturnType<typeof getSupabase>,
  collectionId: string,
  articleSlug: string
): Promise<void> {
  const { error } = await sb
    .from('collection_items')
    .upsert(
      { collection_id: collectionId, article_slug: articleSlug },
      { onConflict: 'collection_id,article_slug' }
    )

  if (error) throw error
}

export async function removeFromCollection(
  sb: ReturnType<typeof getSupabase>,
  collectionId: string,
  articleSlug: string
): Promise<void> {
  const { error } = await sb
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('article_slug', articleSlug)

  if (error) throw error
}

export async function getCollectionItems(
  sb: ReturnType<typeof getSupabase>,
  collectionId: string
): Promise<string[]> {
  const { data, error } = await sb
    .from('collection_items')
    .select('article_slug')
    .eq('collection_id', collectionId)

  if (error) throw error
  return (data || []).map((r: { article_slug: string }) => r.article_slug)
}

export async function getPublicCollection(
  sb: ReturnType<typeof getSupabase>,
  ownerId: string,
  slug: string
): Promise<{ collection: Collection; items: string[] } | null> {
  const { data: collection, error: colError } = await sb
    .from('collections')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .eq('is_public', true)
    .single()

  if (colError || !collection) return null

  const items = await getCollectionItems(sb, collection.id)
  return { collection: collection as Collection, items }
}

export async function deleteCollection(
  sb: ReturnType<typeof getSupabase>,
  collectionId: string
): Promise<void> {
  const { error } = await sb
    .from('collections')
    .delete()
    .eq('id', collectionId)

  if (error) throw error
}

export async function toggleCollectionPublic(
  sb: ReturnType<typeof getSupabase>,
  collectionId: string,
  isPublic: boolean
): Promise<void> {
  const { error } = await sb
    .from('collections')
    .update({ is_public: isPublic })
    .eq('id', collectionId)

  if (error) throw error
}

export async function getCollectionsWithArticleState(
  sb: ReturnType<typeof getSupabase>,
  articleSlug: string
): Promise<{ collections: Collection[]; inCollectionIds: Set<string> }> {
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { collections: [], inCollectionIds: new Set() }

  const { data: collections } = await sb
    .from('collections')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (!collections || (collections as Collection[]).length === 0) {
    return { collections: [], inCollectionIds: new Set() }
  }

  const colIds = (collections as Collection[]).map((c) => c.id)
  const { data: items } = await sb
    .from('collection_items')
    .select('collection_id')
    .eq('article_slug', articleSlug)
    .in('collection_id', colIds)

  const inCollectionIds = new Set(
    (items || []).map((r: { collection_id: string }) => r.collection_id)
  )

  return { collections: collections as Collection[], inCollectionIds }
}
