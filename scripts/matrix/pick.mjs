// pick.mjs — print JSON rows for a pipeline queue, for drivers to iterate.
// Usage: node scripts/matrix/pick.mjs --queue images|write --limit N
//   images: rows needing an image (image_prompt set, image_status none/prompt_ready)
//   write : image-first write queue (image ready, text_status='idea')
import helpers from './lib.mjs'
const DOMAIN = '1001sovet.ru'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const queue = arg('--queue', 'images')
const limit = parseInt(arg('--limit', '10'), 10)
const verticals = (arg('--verticals', '') || '').split(',').filter(Boolean)

const sb = helpers.getServiceClient()
let q = sb.from('content_matrix')
  .select('id,slug,title,description,category,vertical,image_prompt,frontmatter,outline')
  .eq('domain', DOMAIN).eq('disposition', 'active')

if (queue === 'images') {
  q = q.not('image_prompt', 'is', null).in('image_status', ['none', 'prompt_ready'])
       .order('priority', { ascending: false }).order('created_at', { ascending: true })
} else if (queue === 'write') {
  q = q.eq('text_status', 'idea').in('image_status', ['generated', 'approved'])
       .order('priority', { ascending: false }).order('image_generated_at', { ascending: true })
} else { console.error('bad --queue'); process.exit(1) }

if (verticals.length) q = q.in('vertical', verticals)
const { data, error } = await q.limit(limit)
if (error) { console.error('pick error:', error.message); process.exit(1) }
process.stdout.write(JSON.stringify(data || []))
