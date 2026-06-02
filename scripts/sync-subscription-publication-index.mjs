import { createClient } from '@supabase/supabase-js'
import { buildPublicationIndex } from './build-subscription-publication-index.mjs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })
const rows = buildPublicationIndex()
const { error } = await supabase.from('articles_publication_index').upsert(rows, { onConflict: 'article_slug' })

if (error) {
  console.error(error)
  process.exit(1)
}

console.log(`Synced ${rows.length} subscription publication rows`)
