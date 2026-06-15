import { escapeHtml } from '../utils'

/**
 * Render the HTML confirmation page shown when a user clicks a confirmation link.
 */
export function renderConfirmPage(token: string): Response {
  return new Response(`<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Подтверждение подписки</title></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:32px;background:#f7f3ef;color:#1a1a1a">
  <main style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e4df;border-radius:8px;padding:24px">
    <h1 style="font-size:24px;margin:0 0 12px">Подтвердите подписку</h1>
    <p style="line-height:1.6">Нажмите кнопку, чтобы включить уведомления по выбранным категориям.</p>
    <form method="post" action="/subscriptions/confirm">
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <button type="submit" style="background:#c0392b;color:#fff;border:0;border-radius:6px;padding:12px 16px;font-weight:700;cursor:pointer">Подтвердить</button>
    </form>
  </main>
</body>
</html>`, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
