// provider-errors.mjs — classify provider failures for clear CI signalling.
//
// Exit-42 contract: generate-article.mjs exits with EXIT_PROVIDER_BALANCE (42)
// and prints a single stderr line `PROVIDER_BALANCE_EXHAUSTED provider=<name>`
// when the text or image provider reports credit/quota/balance exhaustion.
// The operator must top up the provider balance (or approve a fallback);
// there is NO silent fallback provider by design. All other failures exit 1.
//
// Exit-43 contract: the workflow gate blocks SCHEDULED runs while the
// FACTORY_PAUSE_REASON repo var is non-empty (explicit operator pause).

export const EXIT_PROVIDER_BALANCE = 42
export const EXIT_OPERATOR_PAUSE = 43

const BALANCE_PATTERNS = [
  /credit balance/i,
  /balance is too low/i,
  /insufficient.?quota/i,
  /exceed(ed)? (your )?(current )?quota/i,
  /not enough (credit|balance|funds)/i,
  /payment required/i,
]

const AUTH_PATTERNS = [
  /invalid (api|x-api) key/i,
  /authentication/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid relay token/i,
]

const TIMEOUT_PATTERNS = [
  /\b524\b/,
  /\btimeout\b/i,
  /timed? out/i,
  /econnreset/i,
  /econnrefused/i,
  /etimedout/i,
  /fetch failed/i,
  /socket hang up/i,
  /relay timeout/i,
]

// Kinds that mean the PROVIDER (or its relay transport) is down for everyone —
// the batch must stop immediately and must never let a partial batch publish.
export const PROVIDER_WIDE_KINDS = ['balance', 'auth', 'unavailable', 'timeout', 'rate_limited']

const ACTIONS = {
  balance:
    'Top up the provider account balance (relay transport does not own the balance). ' +
    'No fallback provider exists: pause scheduled runs via FACTORY_PAUSE_REASON until resolved.',
  auth:
    'Verify provider credentials/relay token configuration. Do not retry until fixed.',
  unavailable:
    'Provider or relay temporarily unreachable. Check relay health and provider status. ' +
    'A later retry may succeed but is not proof of recovery.',
  timeout:
    'Provider or relay timed out (incl. HTTP 524 relay timeout). Check relay health; ' +
    'a timeout does NOT prove the credit balance is restored.',
  rate_limited:
    'Provider rate limit (non-quota). Retry later with backoff.',
  unknown: 'Not classified as a provider outage. Inspect the run logs.',
  request: 'Provider rejected the request. Check the selected model and request configuration.',
}

// Returns the provider name ('anthropic' | 'fal') when the error signals
// balance/quota exhaustion, otherwise null.
export function classifyProviderBalanceError(err) {
  const msg = String(err?.message || err || '')
  const status = err?.status ?? err?.statusCode ?? statusFromMessage(msg)
  if (status !== 402 && !BALANCE_PATTERNS.some((re) => re.test(msg))) return null
  return /^fal\b/i.test(msg) ? 'fal' : 'anthropic'
}

// Structured, machine-readable failure classifier. Provider attribution MUST be
// supplied by the CALL SITE (provider + stage of the call that threw) — it is
// never guessed from unrelated DB errors that happen to mention quota/payment.
// The returned object carries stable reason codes and a safe operator action;
// it never contains the raw provider response body or credentials.
export function classifyProviderFailure(err, { provider = 'unknown', stage = 'unknown' } = {}) {
  const msg = String(err?.message || err || '')
  const status = err?.status ?? err?.statusCode ?? statusFromMessage(msg)
  let kind = 'unknown'
  if (status === 402 || BALANCE_PATTERNS.some((re) => re.test(msg))) {
    kind = 'balance'
  } else if (status === 429) {
    // Quota-bearing 429 IS balance exhaustion; a plain 429 is just rate limit.
    kind = /quota/i.test(msg) ? 'balance' : 'rate_limited'
  } else if (status === 401 || status === 403 || AUTH_PATTERNS.some((re) => re.test(msg))) {
    kind = 'auth'
  } else if (status !== undefined && status >= 500 && status !== 524) {
    kind = 'unavailable'
  } else if (status === 524 || TIMEOUT_PATTERNS.some((re) => re.test(msg))) {
    kind = 'timeout'
  } else if (status !== undefined && status >= 400) {
    kind = 'request'
  }
  return buildFailure(kind, provider, stage, status)
}

export function buildFailure(kind, provider, stage, status) {
  return {
    kind,
    provider: kind === 'unknown' ? null : provider,
    stage,
    reason: kind === 'unknown' ? 'unclassified_failure' : `${provider}_${kind}`,
    action: ACTIONS[kind] || ACTIONS.unknown,
    status: typeof status === 'number' ? status : null,
    retryable: kind === 'unavailable' || kind === 'timeout' || kind === 'rate_limited',
  }
}

// Wrap an error thrown by a provider call site: when it classifies as a
// provider failure, return a ProviderFailureError that carries the structured
// failure and a SAFE message (never the raw provider response). Unclassified
// errors pass through unchanged.
export function asProviderError(err, { provider, stage }) {
  const failure = classifyProviderFailure(err, { provider, stage })
  if (failure.kind === 'unknown') {
    failure.provider = provider
    failure.stage = stage
    failure.reason = `${provider}_request_failed`
    failure.kind = 'request'
    failure.action = ACTIONS.request
  }
  return new ProviderFailureError(failure)
}

export class ProviderFailureError extends Error {
  constructor(failure) {
    super(failure.reason)
    this.name = 'ProviderFailureError'
    this.failure = failure
  }
}

export function isProviderWide(failure) {
  return !!failure && PROVIDER_WIDE_KINDS.includes(failure.kind)
}

function statusFromMessage(msg) {
  const m = msg.match(/\b(\d{3})\b/)
  return m ? Number(m[1]) : undefined
}
