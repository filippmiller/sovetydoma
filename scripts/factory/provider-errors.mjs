// provider-errors.mjs — classify provider failures for clear CI signalling.
//
// Exit-42 contract: generate-article.mjs exits with EXIT_PROVIDER_BALANCE (42)
// and prints a single stderr line `PROVIDER_BALANCE_EXHAUSTED provider=<name>`
// when the text or image provider reports credit/quota/balance exhaustion.
// The operator must top up the provider balance (or approve a fallback);
// there is NO silent fallback provider by design. All other failures exit 1.

export const EXIT_PROVIDER_BALANCE = 42

const BALANCE_PATTERNS = [
  /credit balance/i,
  /balance is too low/i,
  /insufficient.?quota/i,
  /exceed(ed)? (your )?(current )?quota/i,
  /not enough (credit|balance|funds)/i,
  /payment required/i,
]

// Returns the provider name ('anthropic' | 'fal') when the error signals
// balance/quota exhaustion, otherwise null.
export function classifyProviderBalanceError(err) {
  const msg = String(err?.message || err || '')
  const status = err?.status ?? err?.statusCode ?? statusFromMessage(msg)
  if (status !== 402 && !BALANCE_PATTERNS.some((re) => re.test(msg))) return null
  return /^fal\b/i.test(msg) ? 'fal' : 'anthropic'
}

function statusFromMessage(msg) {
  const m = msg.match(/\b(\d{3})\b/)
  return m ? Number(m[1]) : undefined
}
