/**
 * A thin fetch wrapper that adds an AbortController-based timeout.
 * Same request/response semantics as fetch(); just aborts if no response
 * arrives within `ms` milliseconds (default 8 000 ms).
 *
 * Do NOT use this for streaming responses — aborting mid-stream would
 * truncate the body.
 */
export async function fetchWithTimeout(url: RequestInfo | URL, init?: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}
