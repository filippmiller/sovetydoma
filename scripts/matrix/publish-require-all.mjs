export function validateRequiredSlugs(requested) {
  if (!Array.isArray(requested) || requested.length === 0 || requested.some((s) => typeof s !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) || new Set(requested).size !== requested.length) {
    throw new Error('Requested publish slugs must be nonempty, valid, and unique.')
  }
  return true
}

export function assertAllSlugsReady(requested, picked) {
  validateRequiredSlugs(requested)
  const ready = new Set((picked || []).map((r) => r.slug))
  const missing = requested.filter((s) => !ready.has(s))
  if (missing.length) throw new Error(`Required slugs are not all ready; no articles will publish: ${missing.join(', ')}`)
  return true
}

export function allSlugsPublished(requested, published) {
  return Array.isArray(requested) && requested.length > 0 && Number.isInteger(published) && published === requested.length
}

export function updateConfirmed(data, expectedId) {
  return Array.isArray(data) && data.length === 1 && data[0]?.id === expectedId
}
