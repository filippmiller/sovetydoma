// A date-sorted feed inside a single category can still read as monotonous —
// e.g. six "сарай" posts in a row just because they happened to publish back
// to back. This keeps the list "mostly newest first" but forbids more than
// `maxRun` consecutive items sharing the same topic key, by pulling the next
// differently-keyed item forward. It does not reorder anything when the feed
// is already diverse, so it's a no-op safety net rather than a re-ranking.
export function limitConsecutiveTopics<T>(
  items: T[],
  keyOf: (item: T) => string | undefined,
  maxRun = 2,
): T[] {
  const result = [...items]
  for (let i = maxRun; i < result.length; i++) {
    const currentKey = keyOf(result[i])
    if (!currentKey) continue
    const precedingRun = result.slice(i - maxRun, i).every((item) => keyOf(item) === currentKey)
    if (!precedingRun) continue

    const swapIndex = result.findIndex((item, j) => j > i && keyOf(item) !== currentKey)
    if (swapIndex === -1) continue

    const tmp = result[i]
    result[i] = result[swapIndex]
    result[swapIndex] = tmp
  }
  return result
}
