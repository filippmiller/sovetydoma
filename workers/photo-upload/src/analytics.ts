// ---------------------------------------------------------------------------
// Analytics helpers extracted from index.ts.
// Owns: parseUserAgent, classifyTraffic, UTM/path/slug parsing utilities,
//       handleAnalytics logic consumed by index.ts via callSupabaseRpc.
// ---------------------------------------------------------------------------

export function parseUserAgent(userAgent: string): { device_type: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase()
  const device_type = /mobile|android|iphone|ipod/.test(ua) ? 'mobile' : /ipad|tablet/.test(ua) ? 'tablet' : 'desktop'
  const browser = /edg\//.test(ua) ? 'Edge'
    : /opr\//.test(ua) ? 'Opera'
      : /chrome\//.test(ua) ? 'Chrome'
        : /firefox\//.test(ua) ? 'Firefox'
          : /safari\//.test(ua) ? 'Safari'
            : 'Other'
  const os = /windows/.test(ua) ? 'Windows'
    : /android/.test(ua) ? 'Android'
      : /iphone|ipad|ipod/.test(ua) ? 'iOS'
        : /mac os|macintosh/.test(ua) ? 'macOS'
          : /linux/.test(ua) ? 'Linux'
            : 'Other'
  return { device_type, browser, os }
}

export function classifyTraffic(
  req: Request,
  payload: Record<string, unknown>,
): { classification: string; bot_reason: string } {
  const ua = req.headers.get('User-Agent') || ''
  const lower = ua.toLowerCase()
  const cf = (req as unknown as { cf?: { botManagement?: { verifiedBot?: boolean; score?: number }; clientTcpRtt?: number } }).cf
  const signals = (payload.signals || {}) as Record<string, unknown>

  if (cf?.botManagement?.verifiedBot) return { classification: 'bot', bot_reason: 'cloudflare_verified_bot' }
  if (typeof cf?.botManagement?.score === 'number' && cf.botManagement.score < 20) {
    return { classification: 'bot', bot_reason: 'cloudflare_low_score' }
  }
  if (/bot|crawler|spider|slurp|yandex|googlebot|bingbot|duckduckbot|baiduspider|ahrefs|semrush|mj12bot|dotbot|bytespider|curl|wget|python|headless|phantom|puppeteer|playwright/.test(lower)) {
    return { classification: 'bot', bot_reason: 'user_agent' }
  }
  if (signals.webdriver === true) return { classification: 'bot', bot_reason: 'webdriver' }

  const hasHumanSignals = Boolean(signals.language) && Boolean(signals.timezone) && Number(signals.viewport_width || 0) > 0
  if (payload.event_name === 'page_view_end' && Number(payload.duration_seconds || 0) >= 5 && hasHumanSignals) {
    return { classification: 'human', bot_reason: '' }
  }
  if (hasHumanSignals) return { classification: 'likely_human', bot_reason: '' }
  return { classification: 'unknown', bot_reason: '' }
}

export function cleanText(value: unknown, maxLength: number): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function cleanArticleSlug(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120)
}

export function cleanId(value: unknown, maxLength = 80): string {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLength)
}

export function cleanPath(value: unknown): string {
  const path = String(value || '/').trim().slice(0, 500)
  if (!path.startsWith('/')) return '/'
  return path.replace(/[\r\n]/g, '')
}

export function referrerDomain(value: unknown): string {
  try {
    const referrer = String(value || '').trim()
    if (!referrer) return ''
    return new URL(referrer).hostname.replace(/^www\./, '').slice(0, 200)
  } catch {
    return ''
  }
}

export function parseUtm(pathValue: string): { utm_source: string; utm_medium: string; utm_campaign: string } {
  try {
    const url = new URL(pathValue, 'https://1001sovet.ru')
    return {
      utm_source: cleanText(url.searchParams.get('utm_source'), 120),
      utm_medium: cleanText(url.searchParams.get('utm_medium'), 120),
      utm_campaign: cleanText(url.searchParams.get('utm_campaign'), 200),
    }
  } catch {
    return { utm_source: '', utm_medium: '', utm_campaign: '' }
  }
}
