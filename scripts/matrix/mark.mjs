// mark.mjs — update a content_matrix row and log an event.
// Usage: node scripts/matrix/mark.mjs --id <uuid> --set '<json>' [--axis text|image|disposition] [--agent name] [--note "..."]
import helpers from './lib.mjs'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const id = arg('--id')
const setRaw = arg('--set', '{}')
const axis = arg('--axis', null)
const agent = arg('--agent', 'pipeline')
const note = arg('--note', null)
if (!id) { console.error('need --id'); process.exit(1) }
let patch
try { patch = JSON.parse(setRaw) } catch { console.error('bad --set json'); process.exit(1) }

const sb = helpers.getServiceClient()
const { data: before } = await sb.from('content_matrix').select('text_status,image_status,disposition').eq('id', id).single()
const { error } = await sb.from('content_matrix').update(patch).eq('id', id)
if (error) { console.error('update error:', error.message); process.exit(1) }
if (axis && before) {
  const fromV = before[axis === 'text' ? 'text_status' : axis === 'image' ? 'image_status' : 'disposition']
  const toV = patch[axis === 'text' ? 'text_status' : axis === 'image' ? 'image_status' : 'disposition'] ?? fromV
  await sb.from('content_matrix_events').insert({ matrix_id: id, axis, from_value: fromV, to_value: toV, agent, notes: note })
}
console.log('ok ' + id)
