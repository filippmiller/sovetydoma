// factory-runner.mjs — small tested runner between the GitHub workflow YAML and
// generate-article.mjs. Keeps shell blocks tiny (no logic, no input
// interpolation) and makes result propagation machine-readable.
//
// Modes:
//   gate      — operator pause check for SCHEDULED runs only. Nonempty
//               FACTORY_PAUSE_REASON => explicit blocked exit 43 + result JSON.
//               Also (re)initializes the result file so a stale file from a
//               previous run on the self-hosted runner is never reused.
//   generate  — resolve categories (auto rotation / all / explicit list),
//               spawn the generator, propagate its exit code, make sure a
//               machine-readable result JSON always exists afterwards.
//   report    — read the result JSON, write the GitHub step summary and job
//               outputs (exit_code / provider / reason / action). Always safe.
//
// Import-safe: no env reads or child spawns at import time.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { EXIT_OPERATOR_PAUSE } from './provider-errors.mjs'
import { CATEGORIES, rotateCategory } from './factory-config.mjs'

const FACTORY_DIR = path.dirname(fileURLToPath(import.meta.url))
const GENERATOR = path.join(FACTORY_DIR, 'generate-article.mjs')

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)

export function checkPause({ eventName, pauseReason }) {
  const reason = String(pauseReason || '').trim()
  if (eventName === 'schedule' && reason) {
    return {
      paused: true,
      reason,
      action: 'Operator pause: clear the FACTORY_PAUSE_REASON repo var after the outage is resolved. Scheduled requests stay blocked until then.',
    }
  }
  return { paused: false, reason: '', action: '' }
}

// Validates workflow input categories: empty/auto -> one rotating category,
// 'all' -> every category, otherwise a comma list of known slugs.
export function selectCategories(input, epochSeconds) {
  const sel = String(input || '').trim()
  if (!sel || sel === 'auto') {
    return { mode: 'auto', categories: [rotateCategory(epochSeconds ?? Math.floor(Date.now() / 1000))] }
  }
  if (sel === 'all') return { mode: 'all', categories: Object.keys(CATEGORIES) }
  const parts = sel.split(',').map((s) => s.trim())
  if (parts.some((s) => !s)) return { mode: 'error', categories: [], error: 'Category list contains an empty item.' }
  const categories = [...new Set(parts)]
  const unknown = categories.filter((c) => !CATEGORIES[c])
  if (unknown.length) return { mode: 'error', categories: [], error: `Unknown categories: ${unknown.join(', ')}` }
  return { mode: 'list', categories }
}

export function emptyResult(overrides = {}) {
  return {
    schema: 1,
    ok: false,
    exitCode: 1,
    dryRun: false,
    halted: false,
    textProvider: null,
    textModel: null,
    imageProvider: null,
    imageModel: null,
    counts: { requested: 0, attempted: 0, generated: 0 },
    failure: null,
    categories: [],
    generated: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Result file handling

export function resolveResultPath(env) {
  return env.FACTORY_RESULT_PATH || path.join(env.RUNNER_TEMP || os.tmpdir(), `sovetydoma-factory-result-${env.GITHUB_RUN_ID || 'local'}-${env.GITHUB_RUN_ATTEMPT || '1'}.json`)
}

// Always (re)initialize before a run so an old file from a previous run on the
// persistent self-hosted runner is never mistaken for this run's result.
export function resetResultFile(env) {
  const p = resolveResultPath(env)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(emptyResult({ exitCode: -1, failure: { kind: 'unknown', provider: null, stage: 'pipeline', reason: 'run_not_completed', action: 'Generator did not complete; inspect the run logs.' } }), null, 2))
  return p
}

export function readResultFile(env) {
  const p = resolveResultPath(env)
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.schema === 1) return { path: p, result: parsed }
    return { path: p, result: null }
  } catch {
    return { path: p, result: null }
  }
}

// ---------------------------------------------------------------------------
// Modes

export function runGate(env, io = {}) {
  const out = io.stdout || ((s) => console.log(s))
  const resultPath = resetResultFile(env)
  const gate = checkPause({ eventName: env.GITHUB_EVENT_NAME, pauseReason: env.FACTORY_PAUSE_REASON })
  if (!gate.paused) {
    out('No operator pause (FACTORY_PAUSE_REASON empty); continuing.')
    return { exitCode: 0, result: null }
  }
  const result = emptyResult({
    exitCode: EXIT_OPERATOR_PAUSE,
    failure: {
      kind: 'operator_pause',
      provider: null,
      stage: 'pipeline',
      reason: 'operator_pause',
      action: gate.action,
      pauseReason: gate.reason,
    },
  })
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2))
  out(`::error::Operator pause: FACTORY_PAUSE_REASON is set — scheduled run blocked (exit ${EXIT_OPERATOR_PAUSE}).`)
  out(`Reason: ${workflowSafeLine(gate.reason)}`)
  return { exitCode: EXIT_OPERATOR_PAUSE, result }
}

export function runGenerate(env, deps = {}) {
  const spawnImpl = deps.spawnSync || spawnSync
  const generatorPath = deps.generatorPath || GENERATOR
  const now = deps.now || (() => Date.now())
  const logger = deps.logger || console
  resetResultFile(env)
  const selection = selectCategories(env.FACTORY_INPUT_CATEGORIES, Math.floor(now() / 1000))
  if (selection.mode === 'error') {
    logger.error(workflowSafeLine(selection.error))
    const result = inputFailure('invalid_category_input', 'Provide a known category slug, comma list, all, or auto.')
    persistResult(env, result)
    return { exitCode: 1, result }
  }
  const rawDryRun = String(env.FACTORY_INPUT_DRY_RUN || '').trim().toLowerCase()
  if (rawDryRun && rawDryRun !== 'true' && rawDryRun !== 'false') {
    const result = inputFailure('invalid_dry_run_input', 'Set dry_run to true or false; generation was not started.')
    persistResult(env, result)
    logger.error(result.failure.action)
    return { exitCode: 1, result }
  }
  const dryRun = rawDryRun === 'true'

  logger.log(`Selected categories: ${selection.categories.join(', ')}${dryRun ? ' [dry-run]' : ''}`)
  const categories = selection.mode === 'all' ? [null] : selection.categories
  const aggregate = emptyResult({ counts: { requested: selection.categories.length, attempted: 0, generated: 0 } })
  let pipelineCode = 0
  for (const category of categories) {
    const args = category === null ? ['--all'] : ['--category', category]
    if (dryRun) args.push('--dry-run')
    resetResultFile(env)
    const childEnv = { ...process.env, ...env, FACTORY_RESULT_PATH: resolveResultPath(env) }
    const proc = spawnImpl(process.execPath, [generatorPath, ...args], { env: childEnv, cwd: deps.cwd || process.cwd(), stdio: 'inherit' })
    const childCode = Number.isInteger(proc.status) ? proc.status : 1
    const { result } = readResultFile(env)
    const expectedCount = category === null ? selection.categories.length : 1
    const categoriesFinalized = result?.ok
      ? result.categories.length === expectedCount
      : result?.dryRun ? result.categories.length === expectedCount : result?.categories.length === result?.counts?.attempted
    if (!validResult(result) || result.counts.requested !== expectedCount || !categoriesFinalized || result.exitCode !== childCode) {
      const code = childCode === 0 ? 1 : childCode
      const reason = !readResultFile(env).result || readResultFile(env).result?.failure?.reason === 'run_not_completed' ? 'generator_failed_without_result' : (proc.error ? 'generator_spawn_error' : 'generator_result_invalid')
      const failed = synthesizeFailure(selection.categories.length, code, reason, aggregate)
      persistResult(env, failed)
      logger.error('Generator did not return a valid finalized result matching its process status.')
      return { exitCode: code, result: failed }
    }
    if (!aggregate.textProvider) Object.assign(aggregate, { textProvider: result.textProvider, textModel: result.textModel, imageProvider: result.imageProvider, imageModel: result.imageModel, dryRun: result.dryRun })
    aggregate.counts.attempted += result.counts.attempted
    aggregate.counts.generated += result.counts.generated
    aggregate.categories.push(...result.categories)
    aggregate.generated.push(...result.generated)
    if (!result.ok) { aggregate.failure = result.failure; aggregate.halted = result.halted; pipelineCode = childCode || 1; break }
  }
  aggregate.ok = pipelineCode === 0 && aggregate.categories.length === selection.categories.length && aggregate.categories.every((c) => c.ok)
  aggregate.exitCode = aggregate.ok ? 0 : (pipelineCode || 1)
  persistResult(env, aggregate)
  return { exitCode: aggregate.exitCode, result: aggregate }
}

function validResult(r) {
  return !!r && r.schema === 1 && typeof r.ok === 'boolean' && Number.isInteger(r.exitCode) && r.exitCode >= 0 &&
    r.ok === (r.exitCode === 0) && r.counts && ['requested', 'attempted', 'generated'].every((k) => Number.isInteger(r.counts[k]) && r.counts[k] >= 0) &&
    r.counts.generated <= r.counts.attempted && r.counts.attempted <= r.counts.requested &&
    Array.isArray(r.categories) && Array.isArray(r.generated) && (r.ok || (r.failure && typeof r.failure.reason === 'string' && typeof r.failure.action === 'string'))
}

function synthesizeFailure(requested, exitCode, reason, prior = emptyResult()) {
  return {
    ...prior,
    ok: false,
    exitCode,
    counts: { requested, attempted: prior.counts.attempted, generated: prior.counts.generated },
    failure: { kind: 'unknown', provider: null, stage: 'pipeline', reason, action: 'Inspect generator process status and logs.' },
  }
}
function inputFailure(reason, action) {
  return emptyResult({ failure: { kind: 'config', provider: null, stage: 'config', reason, action } })
}
function persistResult(env, result) { const p = resolveResultPath(env); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(result, null, 2)) }
function workflowSafeLine(s) { return String(s).replace(/[\r\n\0-\x1f\x7f]/g, ' ').slice(0, 500) }

export function runReport(env, io = {}) {
  const lines = []
  const emit = (s) => {
    lines.push(s)
    ;(io.logger || console).log(s)
  }
  const read = readResultFile(env)
  const resultPath = read.path
  const result = validResult(read.result) ? read.result : null
  const outputs = {}
  const githubOutput = io.githubOutput ?? env.GITHUB_OUTPUT ?? process.env.GITHUB_OUTPUT
  const setOutput = (k, v) => {
    outputs[k] = v
    if (io.setOutput) io.setOutput(k, v)
    else if (githubOutput) fs.appendFileSync(githubOutput, `${k}=${v}${os.EOL}`)
  }

  const stepFailure = ['CHECKOUT_OUTCOME', 'PNPM_SETUP_OUTCOME', 'NODE_SETUP_OUTCOME', 'GATE_OUTCOME', 'INSTALL_OUTCOME', 'PYTHON_SETUP_OUTCOME', 'GENERATE_OUTCOME', 'PUBLISH_OUTCOME', 'PRESERVE_OUTCOME', 'ARTIFACT_OUTCOME'].find((k) => env[k] === 'failure')
  const failedSteps = ['CHECKOUT_OUTCOME', 'PNPM_SETUP_OUTCOME', 'NODE_SETUP_OUTCOME', 'GATE_OUTCOME', 'INSTALL_OUTCOME', 'PYTHON_SETUP_OUTCOME', 'GENERATE_OUTCOME', 'PUBLISH_OUTCOME', 'PRESERVE_OUTCOME', 'ARTIFACT_OUTCOME'].filter((k) => env[k] === 'failure')
  if (!result) {
    emit('## Content factory report')
    emit('')
    emit(`No machine-readable result found (${resultPath}). Treating as failure.`)
    setOutput('exit_code', '1')
    setOutput('provider', 'unknown')
    setOutput('reason', failedSteps.length ? `pipeline_${failedSteps.map((s) => s.toLowerCase()).join('+')}` : 'result_missing')
    setOutput('action', artifactAction(failedSteps))
    emit(`- Pipeline step failures: ${failedSteps.join(', ') || stepFailure || 'none'}`)
    flushSummary()
    return { outputs, exitCode: 0 }
  }

  const f = result.failure
  const pipelineFailure = failedSteps[0] || (env.GENERATE_OUTCOME === 'failure' && result.ok ? 'GENERATE_OUTCOME' : '')
  const failed = !result.ok || !!pipelineFailure
  emit('## Content factory report')
  emit('')
  emit(`- Status: **${failed ? 'FAILED' : 'OK'}** (exit ${failed && result.exitCode === 0 ? 1 : result.exitCode})`)
  emit(`- Text: ${result.textProvider || '?'} / ${result.textModel || '?'} · Image: ${result.imageProvider || '?'} / ${result.imageModel || '?'}`)
  emit(`- Requested: ${result.counts.requested} · Attempted: ${result.counts.attempted} · Generated: ${result.counts.generated}${result.dryRun ? ' · dry-run' : ''}`)
  if (f) {
    emit(`- Failure: ${workflowSafeLine(f.reason)}${f.provider ? ` (provider=${f.provider}, stage=${f.stage})` : ''}`)
    emit(`- Operator action: ${workflowSafeLine(f.action)}`)
    if (f.pauseReason) emit(`- Pause reason: ${workflowSafeLine(f.pauseReason)}`)
  }
  if (result.halted) emit('- Batch halted on provider-wide outage — partial rows must NOT publish.')
  if (failedSteps.length) emit(`- Pipeline step failures: ${failedSteps.join(', ')}`)
  else if (pipelineFailure) emit(`- Pipeline step failure: ${pipelineFailure}`)

  setOutput('exit_code', String(failed && result.exitCode === 0 ? 1 : result.exitCode))
  setOutput('provider', f?.provider || 'none')
  setOutput('reason', f?.reason || (failedSteps.length ? `pipeline_${failedSteps.map((s) => s.toLowerCase()).join('+')}` : (pipelineFailure ? `pipeline_${pipelineFailure.toLowerCase()}` : (result.ok ? 'ok' : 'unknown'))))
  setOutput('action', f?.action || (failedSteps.length ? artifactAction(failedSteps) : (pipelineFailure ? 'Review the failed setup or generation step logs.' : 'None.')))
  flushSummary()
  return { outputs, exitCode: 0 }

  function flushSummary() {
    const summaryPath = io.summaryPath ?? env.GITHUB_STEP_SUMMARY ?? process.env.GITHUB_STEP_SUMMARY
    if (summaryPath) fs.appendFileSync(summaryPath, lines.join('\n') + '\n')
  }
}

function artifactAction(failedSteps) {
  if (failedSteps.includes('PUBLISH_OUTCOME')) return 'Review the publish and recovery artifact steps; confirm required images and every requested slug before retrying.'
  if (failedSteps.includes('PRESERVE_OUTCOME') || failedSteps.includes('ARTIFACT_OUTCOME')) return 'Review recovery artifact preparation/upload logs and confirm the generated image files are available before retrying.'
  return 'Inspect the run logs; the pipeline did not produce a finalized result JSON.'
}

// ---------------------------------------------------------------------------
// CLI main

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isMain) {
  const mode = process.argv[2]
  const env = process.env
  let code = 0
  if (mode === 'gate') {
    code = runGate(env).exitCode
  } else if (mode === 'generate') {
    const { exitCode } = runGenerate(env)
    // Surface reason on 42/1 for the logs; result JSON carries the details.
    code = exitCode
  } else if (mode === 'report') {
    code = runReport(env).exitCode
  } else {
    console.error(`Usage: node factory-runner.mjs <gate|generate|report> (got: ${mode || '(none)'})`)
    code = 2
  }
  // Job outputs for downstream steps (report mode already wrote them via env files
  // when GITHUB_OUTPUT is present).
  process.exit(code)
}
