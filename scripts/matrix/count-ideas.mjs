// count-ideas.mjs — print the number of idea rows (text_status='idea') for the domain.
import helpers from './lib.mjs'
const sb = helpers.getServiceClient()
const { count, error } = await sb.from('content_matrix').select('*', { count: 'exact', head: true })
  .eq('domain', '1001sovet.ru').eq('text_status', 'idea')
if (error) { console.error(error.message); process.exit(1) }
process.stdout.write(String(count ?? 0))
