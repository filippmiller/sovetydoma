function safeArticlePath(path) {
  const clean = String(path || '').trim()
  if (!/^\/[a-z0-9][a-z0-9\-\/]*\/$/i.test(clean)) return '/'
  return clean
}

function absoluteUrl(siteUrl, path) {
  const base = String(siteUrl || 'https://1001sovet.ru').replace(/\/+$/, '')
  return encodeURI(`${base}${safeArticlePath(path)}`)
}

function safeExternalUrl(url) {
  try {
    const parsed = new URL(String(url || ''))
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'https://1001sovet.ru/podpiski/'
    return encodeURI(parsed.toString())
  } catch {
    return 'https://1001sovet.ru/podpiski/'
  }
}

export function renderDigestMessage({ channel, articles, siteUrl = 'https://1001sovet.ru', manageUrl = 'https://1001sovet.ru/podpiski/' }) {
  const safeArticles = Array.isArray(articles) ? articles : []
  const title = safeArticles.length === 1
    ? 'Новая статья по вашей подписке'
    : 'Новые статьи по вашим подпискам'

  if (channel === 'sms') {
    const first = safeArticles[0]
    return {
      subject: title,
      text: first
        ? `${first.title}: ${absoluteUrl(siteUrl, first.canonical_path)} Отписка: ${manageUrl}`
        : `Новых статей пока нет. Настройки: ${manageUrl}`,
    }
  }

  const lines = [
    title,
    '',
    ...safeArticles.map((article, index) => `${index + 1}. ${article.title}\n${absoluteUrl(siteUrl, article.canonical_path)}`),
    '',
    `Настройки и отписка: ${manageUrl}`,
  ]

  const safeManageUrl = safeExternalUrl(manageUrl)
  const htmlItems = safeArticles.map((article) => (
    `<li><a href="${absoluteUrl(siteUrl, article.canonical_path)}">${escapeHtml(article.title)}</a><br><span>${escapeHtml(article.description || '')}</span></li>`
  )).join('')

  return {
    subject: title,
    text: lines.join('\n').trim(),
    html: `<h1>${escapeHtml(title)}</h1><ol>${htmlItems}</ol><p><a href="${safeManageUrl}">Настройки и отписка</a></p>`,
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]))
}
