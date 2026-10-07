import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function warn(env, message, logger) {
  logger(`::warning::${message}`)
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `\n> **Telegram alert:** ${message.replace(/[\r\n]/g, ' ')}\n`)
}

export async function sendFactoryAlert(env = process.env, fetchImpl = fetch, logger = console.log) {
  const token = env.TG_BOT_TOKEN
  const chatId = env.TG_CHAT_ID
  if (!token || !chatId) {
    warn(env, 'not sent because TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing; inspect the workflow summary and logs.', logger)
    return { sent: false, reason: 'missing_config' }
  }
  const exit = env.GEN_EXIT || 'unknown'
  const provider = env.GEN_PROVIDER || '?'
  const reason = env.GEN_REASON || 'unknown'
  const action = env.GEN_ACTION || 'Review the workflow logs.'
  const lead = exit === '42' ? 'Provider balance or quota exhausted' : env.GEN_OUTCOME === 'failure' ? 'Content generation failed' : 'Content factory pipeline failed'
  const text = `🚨 Content factory: ${lead}\nprovider=${provider} reason=${reason}\n${action}\nRun: ${env.RUN_URL || '(URL unavailable)'}`
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(10_000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || body?.ok !== true) {
      warn(env, `send failed (HTTP ${res.status}; Telegram API ok=${body?.ok === true ? 'true' : 'false'}). Inspect workflow logs.`, logger)
      return { sent: false, reason: 'send_failed' }
    }
    logger('Telegram alert sent.')
    return { sent: true }
  } catch {
    warn(env, 'send failed because Telegram could not be reached or timed out. The workflow failure remains visible in the summary.', logger)
    return { sent: false, reason: 'network_error' }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  sendFactoryAlert().catch(() => process.exitCode = 0)
}
