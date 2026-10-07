import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import {
  checkPause,
  emptyResult,
  readResultFile,
  resetResultFile,
  runGate,
  runGenerate,
  runReport,
  selectCategories,
} from '../factory/factory-runner.mjs'
import { EXIT_OPERATOR_PAUSE } from '../factory/provider-errors.mjs'
import { CATEGORIES, ROTATION_SLOTS, rotateCategory } from '../factory/factory-config.mjs'
import { sendFactoryAlert } from '../factory/telegram-alert.mjs'
import { preserveArtifact } from '../factory/preserve-artifact.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'content-factory.yml')

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'factory-runner-test-'))
}

function envFor(tmp, overrides = {}) {
  return { FACTORY_RESULT_PATH: path.join(tmp, 'result.json'), ...overrides }
}

describe('checkPause', () => {
  it('blocks scheduled runs with a nonempty pause reason', () => {
    const g = checkPause({ eventName: 'schedule', pauseReason: 'Anthropic balance low — topping up' })
    assert.equal(g.paused, true)
    assert.match(g.reason, /balance/i)
    assert.match(g.action, /FACTORY_PAUSE_REASON/)
  })

  it('allows scheduled runs when the reason is empty/whitespace', () => {
    assert.equal(checkPause({ eventName: 'schedule', pauseReason: '' }).paused, false)
    assert.equal(checkPause({ eventName: 'schedule', pauseReason: '   ' }).paused, false)
  })

  it('never blocks manual runs, even with a pause reason set', () => {
    const g = checkPause({ eventName: 'workflow_dispatch', pauseReason: 'investigating relay' })
    assert.equal(g.paused, false)
  })
})

describe('selectCategories', () => {
  it('auto/empty rotates one category from the weighted slot list', () => {
    for (const input of ['', 'auto']) {
      const sel = selectCategories(input, 1_800_000)
      assert.equal(sel.mode, 'auto')
      assert.equal(sel.categories.length, 1)
      assert.ok(ROTATION_SLOTS.includes(sel.categories[0]))
    }
    // Rotation is deterministic per epoch bucket.
    assert.equal(rotateCategory(0), selectCategories('auto', 0).categories[0])
    assert.equal(rotateCategory(18000 * 7 + 5), selectCategories('auto', 18000 * 7 + 5).categories[0])
  })

  it('all expands to every known category', () => {
    const sel = selectCategories('all', 0)
    assert.equal(sel.mode, 'all')
    assert.deepEqual(sel.categories, Object.keys(CATEGORIES))
  })

  it('comma list passes through validated categories', () => {
    assert.deepEqual(selectCategories('kulinaria, avto', 0).categories, ['kulinaria', 'avto'])
    assert.deepEqual(selectCategories('kulinaria,kulinaria', 0).categories, ['kulinaria'])
    assert.equal(selectCategories('kulinaria,,avto', 0).mode, 'error')
  })

  it('rejects unknown slugs', () => {
    const sel = selectCategories('kulinaria,bogus', 0)
    assert.equal(sel.mode, 'error')
    assert.match(sel.error, /bogus/)
  })
})

describe('runGate', () => {
  it('scheduled + reason => exit 43 and a machine-readable operator_pause result', () => {
    const tmp = makeTmp()
    const io = { stdout: () => {} }
    const { exitCode } = runGate(envFor(tmp, { GITHUB_EVENT_NAME: 'schedule', FACTORY_PAUSE_REASON: 'credits low' }), io)
    assert.equal(exitCode, EXIT_OPERATOR_PAUSE)
    const { result } = readResultFile(envFor(tmp))
    assert.equal(result.failure.reason, 'operator_pause')
    assert.equal(result.exitCode, 43)
    assert.equal(result.counts.requested, 0)
    assert.match(result.failure.pauseReason, /credits low/)
  })

  it('keeps pause reason punctuation readable while flattening controls to one line', () => {
    const tmp = makeTmp()
    const env = envFor(tmp, { GITHUB_EVENT_NAME: 'schedule', FACTORY_PAUSE_REASON: 'Check: alpha,beta\n::warning::not a command' })
    const lines = []
    runGate(env, { stdout: (s) => lines.push(s) })
    assert.equal(lines[1], 'Reason: Check: alpha,beta ::warning::not a command')
    const summaryPath = path.join(tmp, 'summary.md')
    runReport({ ...env, GITHUB_STEP_SUMMARY: summaryPath }, { logger: { log() {} } })
    const summary = fs.readFileSync(summaryPath, 'utf8')
    assert.match(summary, /Pause reason: Check: alpha,beta ::warning::not a command/)
    assert.ok(!summary.includes('%3A'))
    assert.equal(summary.split('\n').filter((line) => line.includes('Pause reason:')).length, 1)
  })

  it('no pause => exit 0 and the result file is reset (no stale self-hosted file)', () => {
    const tmp = makeTmp()
    // Pretend a previous run left a stale "success" file behind.
    fs.writeFileSync(path.join(tmp, 'result.json'), JSON.stringify(emptyResult({ ok: true, exitCode: 0 })))
    const { exitCode } = runGate(envFor(tmp, { GITHUB_EVENT_NAME: 'schedule', FACTORY_PAUSE_REASON: '' }), { stdout: () => {} })
    assert.equal(exitCode, 0)
    const { result } = readResultFile(envFor(tmp))
    assert.equal(result.failure.reason, 'run_not_completed', 'stale file must be reset, not trusted')
  })
})

describe('runGenerate', () => {
  it('propagates exit 42 and surfaces provider/reason from the result JSON', () => {
    const tmp = makeTmp()
    const spawnCalls = []
    const spawnSyncFake = (cmd, args, opts) => {
      spawnCalls.push({ cmd, args, opts })
      fs.writeFileSync(opts.env.FACTORY_RESULT_PATH, JSON.stringify(emptyResult({
        ok: false, exitCode: 42,
        failure: { kind: 'balance', provider: 'anthropic', stage: 'text', reason: 'anthropic_balance', action: 'Top up the balance.' },
        counts: { requested: 1, attempted: 1, generated: 0 },
        categories: [{ category: 'kulinaria', ok: false, reason: 'anthropic_balance', action: 'Top up the balance.' }],
      })))
      return { status: 42 }
    }
    const { exitCode, result } = runGenerate(envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'auto' }), { spawnSync: spawnSyncFake, now: () => 18000_000_000 })
    assert.equal(exitCode, 42)
    assert.equal(result.failure.provider, 'anthropic')
    assert.equal(result.failure.reason, 'anthropic_balance')
    assert.ok(spawnCalls[0].args.includes('--category'), 'auto mode spawns one --category run')
    assert.ok(!spawnCalls[0].args.includes('--all'))
  })

  it('passes --all for the all selection and --dry-run when requested', () => {
    const tmp = makeTmp()
    let seenArgs = null
    const spawnSyncFake = (cmd, args, opts) => {
      seenArgs = args
      fs.writeFileSync(opts.env.FACTORY_RESULT_PATH, JSON.stringify(emptyResult({ ok: true, exitCode: 0, dryRun: true, counts: { requested: Object.keys(CATEGORIES).length, attempted: 0, generated: 0 }, categories: Object.keys(CATEGORIES).map((category) => ({ category, ok: true, dryRun: true })) })))
      return { status: 0 }
    }
    const { exitCode } = runGenerate(
      envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'all', FACTORY_INPUT_DRY_RUN: 'true' }),
      { spawnSync: spawnSyncFake },
    )
    assert.equal(exitCode, 0)
    assert.ok(seenArgs.includes('--all'))
    assert.ok(seenArgs.includes('--dry-run'))
  })

  it('executes every comma-selected category and aggregates the finalized child results', () => {
    const tmp = makeTmp()
    const argsSeen = []
    const spawnSyncFake = (_cmd, args, opts) => {
      const category = args[args.indexOf('--category') + 1]
      argsSeen.push(category)
      const result = emptyResult({ ok: true, exitCode: 0, counts: { requested: 1, attempted: 1, generated: 1 }, categories: [{ category, ok: true, slug: `${category}-article` }], generated: [{ category, slug: `${category}-article` }] })
      fs.writeFileSync(opts.env.FACTORY_RESULT_PATH, JSON.stringify(result))
      return { status: 0 }
    }
    const { exitCode, result } = runGenerate(envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'kulinaria,avto' }), { spawnSync: spawnSyncFake })
    assert.equal(exitCode, 0)
    assert.deepEqual(argsSeen, ['kulinaria', 'avto'])
    assert.equal(result.counts.requested, 2)
    assert.equal(result.counts.generated, 2)
  })

  it('accepts a finalized provider halt from --all even when only the first category was attempted', () => {
    const tmp = makeTmp()
    const { exitCode, result } = runGenerate(envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'all' }), {
      spawnSync: (_cmd, _args, opts) => {
        fs.writeFileSync(opts.env.FACTORY_RESULT_PATH, JSON.stringify(emptyResult({
          ok: false, exitCode: 42, halted: true,
          failure: { kind: 'balance', provider: 'anthropic', stage: 'text', reason: 'anthropic_balance', action: 'Top up the balance.' },
          counts: { requested: Object.keys(CATEGORIES).length, attempted: 1, generated: 0 },
          categories: [{ category: Object.keys(CATEGORIES)[0], ok: false, reason: 'anthropic_balance', action: 'Top up the balance.' }],
        })))
        return { status: 42 }
      },
    })
    assert.equal(exitCode, 42)
    assert.equal(result.failure.reason, 'anthropic_balance')
    assert.equal(result.counts.requested, Object.keys(CATEGORIES).length)
    assert.equal(result.counts.attempted, 1)
  })

  it('resets the result before each selected child so a later missing result cannot reuse earlier success', () => {
    const tmp = makeTmp()
    let calls = 0
    const out = runGenerate(envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'kulinaria,avto' }), {
      spawnSync: (_cmd, _args, opts) => {
        calls++
        if (calls === 1) fs.writeFileSync(opts.env.FACTORY_RESULT_PATH, JSON.stringify(emptyResult({ ok: true, exitCode: 0, counts: { requested: 1, attempted: 1, generated: 1 }, categories: [{ category: 'kulinaria', ok: true }], generated: [{ category: 'kulinaria', slug: 'one-article', imageFilename: 'one-article.jpg' }] })))
        return { status: 0 }
      },
    })
    assert.equal(out.exitCode, 1)
    assert.equal(out.result.failure.reason, 'generator_failed_without_result')
    assert.equal(out.result.counts.requested, 2)
    assert.equal(out.result.counts.attempted, 1)
    assert.equal(out.result.counts.generated, 1)
    assert.equal(out.result.generated[0].imageFilename, 'one-article.jpg')
  })

  it('runs a real child process and rejects a finalized JSON result that disagrees with its exit code', () => {
    const tmp = makeTmp()
    const child = path.join(tmp, 'fake-generator.mjs')
    fs.writeFileSync(child, `import fs from 'node:fs'; fs.writeFileSync(process.env.FACTORY_RESULT_PATH, JSON.stringify(${JSON.stringify(emptyResult({ ok: true, exitCode: 0, counts: { requested: 1, attempted: 1, generated: 1 }, categories: [{ category: 'kulinaria', ok: true }], generated: [{ category: 'kulinaria', slug: 'sample-article' }] }))})); process.exit(7)`)
    const out = runGenerate(envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'kulinaria' }), { generatorPath: child })
    assert.equal(out.exitCode, 7)
    assert.equal(out.result.ok, false)
    assert.equal(out.result.failure.reason, 'generator_result_invalid')
    assert.equal(readResultFile(envFor(tmp)).result.exitCode, 7)
  })

  it('runs the real generator CLI in isolated dry-run mode and writes to the derived per-run result path', () => {
    const tmp = makeTmp()
    const env = { RUNNER_TEMP: tmp, GITHUB_RUN_ID: 'integration-123', GITHUB_RUN_ATTEMPT: '2', FACTORY_INPUT_CATEGORIES: 'kulinaria', FACTORY_INPUT_DRY_RUN: 'true' }
    assert.equal(env.FACTORY_RESULT_PATH, undefined)
    const resultPath = path.join(tmp, 'sovetydoma-factory-result-integration-123-2.json')
    const out = runGenerate(env, { cwd: tmp })
    assert.equal(out.exitCode, 0)
    assert.equal(out.result.ok, true)
    assert.equal(out.result.dryRun, true)
    assert.equal(fs.existsSync(resultPath), true)
    assert.deepEqual(JSON.parse(fs.readFileSync(resultPath, 'utf8')), out.result)
  })

  it('synthesizes a failure result when the generator dies without one; success-without-result is NOT hidden', () => {
    const tmp = makeTmp()
    const noResult = runGenerate(envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'kulinaria' }), {
      spawnSync: () => ({ status: 1 }),
    })
    assert.equal(noResult.exitCode, 1)
    assert.equal(noResult.result.failure.reason, 'generator_failed_without_result')

    const tmp2 = makeTmp()
    const liar = runGenerate(envFor(tmp2, { FACTORY_INPUT_CATEGORIES: 'kulinaria' }), {
      spawnSync: () => ({ status: 0 }), // exited 0 but wrote no result JSON
    })
    assert.equal(liar.exitCode, 1, 'exit 0 without a result JSON must not look like success')
    assert.equal(liar.result.failure.reason, 'generator_failed_without_result')
  })

  it('rejects invalid category input without spawning anything', () => {
    const tmp = makeTmp()
    let spawned = false
    const { exitCode } = runGenerate(envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'nope' }), {
      spawnSync: () => { spawned = true; return { status: 0 } },
    })
    assert.equal(exitCode, 1)
    assert.equal(spawned, false)
  })

  it('rejects malformed dry-run input as a persisted config failure before spawning', () => {
    const tmp = makeTmp()
    let spawned = false
    const out = runGenerate(envFor(tmp, { FACTORY_INPUT_CATEGORIES: 'kulinaria', FACTORY_INPUT_DRY_RUN: 'tru' }), {
      spawnSync: () => { spawned = true; return { status: 0 } },
    })
    assert.equal(spawned, false)
    assert.equal(out.result.failure.reason, 'invalid_dry_run_input')
    assert.equal(readResultFile(envFor(tmp)).result.failure.reason, 'invalid_dry_run_input')
  })
})

describe('runReport', () => {
  it('writes summary + outputs with provider/reason/action from the result JSON', () => {
    const tmp = makeTmp()
    const env = envFor(tmp)
    resetResultFile(env)
    fs.writeFileSync(env.FACTORY_RESULT_PATH, JSON.stringify(emptyResult({
      ok: false, exitCode: 42,
      textProvider: 'anthropic', textModel: 'claude-sonnet-4-6', imageProvider: 'fal', imageModel: 'fal-ai/flux/schnell',
      failure: { kind: 'balance', provider: 'anthropic', stage: 'text', reason: 'anthropic_balance', action: 'Top up the balance.' },
      counts: { requested: 1, attempted: 1, generated: 0 },
    })))
    const summaryPath = path.join(tmp, 'summary.md')
    const outputs = {}
    runReport(env, { summaryPath, setOutput: (k, v) => { outputs[k] = v } })
    const summary = fs.readFileSync(summaryPath, 'utf8')
    assert.match(summary, /FAILED/)
    assert.match(summary, /anthropic_balance/)
    assert.match(summary, /Top up the balance/)
    assert.equal(outputs.exit_code, '42')
    assert.equal(outputs.provider, 'anthropic')
    assert.equal(outputs.reason, 'anthropic_balance')
    assert.equal(outputs.action, 'Top up the balance.')
    const captured = runReport(env, { setOutput: () => {}, logger: { log() {} } })
    assert.equal(captured.outputs.reason, 'anthropic_balance')
  })

  it('handles a missing result file loudly', () => {
    const tmp = makeTmp()
    const outputs = {}
    runReport(envFor(tmp), { setOutput: (k, v) => { outputs[k] = v } })
    assert.equal(outputs.exit_code, '1')
    assert.equal(outputs.reason, 'result_missing')
  })

  it('reports publishing failure as pipeline failure even when generation succeeded', () => {
    const tmp = makeTmp()
    const env = envFor(tmp, { PUBLISH_OUTCOME: 'failure' })
    fs.writeFileSync(env.FACTORY_RESULT_PATH, JSON.stringify(emptyResult({ ok: true, exitCode: 0, counts: { requested: 1, attempted: 1, generated: 1 }, categories: [{ category: 'kulinaria', ok: true }], generated: [{ category: 'kulinaria', slug: 'article-one', imageFilename: 'article-one.jpg' }] })))
    const summaryPath = path.join(tmp, 'summary.md')
    const outputs = {}
    const reported = runReport(env, { summaryPath, setOutput: (k, v) => { outputs[k] = v }, logger: { log() {} } })
    assert.equal(reported.exitCode, 0)
    assert.equal(outputs.exit_code, '1')
    assert.equal(outputs.reason, 'pipeline_publish_outcome')
    assert.match(outputs.action, /publish and recovery artifact steps/i)
    assert.match(fs.readFileSync(summaryPath, 'utf8'), /FAILED/)
  })

  it('reports artifact upload failure after successful generation', () => {
    const tmp = makeTmp()
    const env = envFor(tmp, { ARTIFACT_OUTCOME: 'failure' })
    fs.writeFileSync(env.FACTORY_RESULT_PATH, JSON.stringify(emptyResult({ ok: true, exitCode: 0, counts: { requested: 1, attempted: 1, generated: 1 }, categories: [{ category: 'kulinaria', ok: true }], generated: [{ category: 'kulinaria', slug: 'article-one', imageFilename: 'article-one.jpg' }] })))
    const outputs = {}
    const reported = runReport(env, { setOutput: (k, v) => { outputs[k] = v }, logger: { log() {} } })
    assert.equal(reported.exitCode, 0)
    assert.equal(outputs.exit_code, '1')
    assert.equal(outputs.reason, 'pipeline_artifact_outcome')
    assert.match(outputs.action, /artifact preparation\/upload logs/i)
  })
})

describe('telegram alert helper (offline)', () => {
  it('warns and writes to summary when config is empty without making an HTTP call', async () => {
    const tmp = makeTmp()
    const summary = path.join(tmp, 'summary.md')
    const logs = []
    let calls = 0
    const result = await sendFactoryAlert({ GITHUB_STEP_SUMMARY: summary }, async () => { calls++ }, (s) => logs.push(s))
    assert.equal(result.reason, 'missing_config')
    assert.equal(calls, 0)
    assert.match(logs[0], /::warning::/)
    assert.match(fs.readFileSync(summary, 'utf8'), /TELEGRAM_BOT_TOKEN/)
  })

  it('handles HTTP and API failures, accepts whitespace JSON true, and never logs token URLs', async () => {
    const tmp = makeTmp()
    const summary = path.join(tmp, 'summary.md')
    const env = { TG_BOT_TOKEN: 'synthetic-token-secret', TG_CHAT_ID: '123', GITHUB_STEP_SUMMARY: summary, GEN_EXIT: '1' }
    const logs = []
    const badHttp = await sendFactoryAlert(env, async () => ({ ok: false, status: 500, json: async () => ({ ok: false }) }), (s) => logs.push(s))
    const apiFalse = await sendFactoryAlert(env, async () => ({ ok: true, status: 200, json: async () => ({ ok: false }) }), (s) => logs.push(s))
    const good = await sendFactoryAlert(env, async () => ({ ok: true, status: 200, json: async () => JSON.parse('  { "ok": true }  ') }), (s) => logs.push(s))
    const network = await sendFactoryAlert(env, async () => { throw new Error('request failed for https://api.telegram.org/bot/synthetic-token-secret/sendMessage') }, (s) => logs.push(s))
    assert.equal(badHttp.reason, 'send_failed')
    assert.equal(apiFalse.reason, 'send_failed')
    assert.equal(good.sent, true)
    assert.equal(network.reason, 'network_error')
    assert.ok(!logs.join('\n').includes('synthetic-token-secret'))
    assert.match(fs.readFileSync(summary, 'utf8'), /send failed/)
  })
})

describe('manual recovery artifact preservation', () => {
  it('copies only generated safe slug.jpg filenames plus the machine result', () => {
    const tmp = makeTmp()
    const images = path.join(tmp, 'public-images')
    const runnerTemp = path.join(tmp, 'runner-temp')
    const resultPath = path.join(tmp, 'factory-result.json')
    fs.mkdirSync(images, { recursive: true })
    fs.mkdirSync(runnerTemp, { recursive: true })
    fs.writeFileSync(path.join(images, 'article-one.jpg'), 'generated image')
    fs.writeFileSync(path.join(images, 'unrelated.jpg'), 'unrelated image')
    fs.writeFileSync(resultPath, JSON.stringify({ schema: 1, counts: { generated: 1 }, generated: [
      { slug: 'article-one', imageFilename: 'article-one.jpg' },
    ] }))
    const preserved = preserveArtifact({ FACTORY_RESULT_PATH: resultPath, FACTORY_IMAGES_DIR: images, RUNNER_TEMP: runnerTemp, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '2' })
    assert.deepEqual(preserved.copiedImages, ['article-one.jpg'])
    assert.ok(fs.existsSync(path.join(preserved.directory, 'result.json')))
    assert.deepEqual(fs.readdirSync(path.join(preserved.directory, 'images')), ['article-one.jpg'])
  })

  it('fails preparation when any expected generated image is missing', () => {
    const tmp = makeTmp()
    const resultPath = path.join(tmp, 'factory-result.json')
    fs.writeFileSync(resultPath, JSON.stringify({ schema: 1, counts: { generated: 1 }, generated: [{ slug: 'missing-image', imageFilename: 'missing-image.jpg' }] }))
    assert.throws(() => preserveArtifact({ FACTORY_RESULT_PATH: resultPath, FACTORY_IMAGES_DIR: path.join(tmp, 'images'), RUNNER_TEMP: path.join(tmp, 'runner') }), /Generated image is missing/)
  })

  it('rejects generated-count mismatches and still allows legitimate zero-image results', () => {
    const tmp = makeTmp()
    const resultPath = path.join(tmp, 'factory-result.json')
    const runnerTemp = path.join(tmp, 'runner')
    fs.writeFileSync(resultPath, JSON.stringify({ schema: 1, counts: { generated: 1 }, generated: [] }))
    assert.throws(() => preserveArtifact({ FACTORY_RESULT_PATH: resultPath, RUNNER_TEMP: runnerTemp }), /metadata does not match/)
    fs.writeFileSync(resultPath, JSON.stringify({ schema: 1, counts: { generated: 0 }, generated: [], ok: false }))
    const preserved = preserveArtifact({ FACTORY_RESULT_PATH: resultPath, RUNNER_TEMP: runnerTemp, GITHUB_RUN_ID: 'zero', GITHUB_RUN_ATTEMPT: '1' })
    assert.deepEqual(preserved.copiedImages, [])
    assert.ok(fs.existsSync(path.join(preserved.directory, 'result.json')))
  })

  it('rejects unsafe image paths before probing or copying any image file', () => {
    const tmp = makeTmp()
    const resultPath = path.join(tmp, 'factory-result.json')
    fs.writeFileSync(resultPath, JSON.stringify({ schema: 1, counts: { generated: 1 }, generated: [{ slug: '../escape', imageFilename: '../escape.jpg' }] }))
    const imageProbes = []
    const io = {
      existsSync(p) { if (p !== resultPath) imageProbes.push(p); return fs.existsSync(p) },
      readFileSync: fs.readFileSync,
      mkdirSync: fs.mkdirSync,
      copyFileSync: fs.copyFileSync,
    }
    assert.throws(() => preserveArtifact({ FACTORY_RESULT_PATH: resultPath, FACTORY_IMAGES_DIR: tmp, RUNNER_TEMP: path.join(tmp, 'runner') }, io), /unsafe generated image filename/)
    assert.deepEqual(imageProbes, [])
  })
})

// Offline workflow checks (actionlint is not installed; these assert the
// safety-critical structure directly from the YAML source).
describe('content-factory.yml structural checks', () => {
  const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8')

  it('pause gate runs BEFORE dependency install and API calls', () => {
    const gateIdx = yml.indexOf('factory-runner.mjs gate')
    const installIdx = yml.indexOf('pnpm install --frozen-lockfile')
    const generateIdx = yml.indexOf('factory-runner.mjs generate')
    assert.ok(gateIdx > -1 && installIdx > -1 && generateIdx > -1)
    assert.ok(gateIdx < installIdx, 'gate must run before pnpm install')
    assert.ok(installIdx < generateIdx)
  })

  it('exposes FACTORY_TEXT_PROVIDER / FACTORY_MODEL / FAL_MODEL repo vars', () => {
    assert.match(yml, /FACTORY_TEXT_PROVIDER: \$\{\{ vars\.FACTORY_TEXT_PROVIDER/)
    assert.match(yml, /FACTORY_MODEL: \$\{\{ vars\.FACTORY_MODEL/)
    assert.match(yml, /FAL_MODEL: \$\{\{ vars\.FAL_MODEL/)
    assert.match(yml, /FACTORY_PAUSE_REASON: \$\{\{ vars\.FACTORY_PAUSE_REASON/)
  })

  it('no inline ${{ inputs.* }} / github.event.inputs interpolation inside run blocks', () => {
    const lines = yml.split('\n')
    let inRun = false
    let runIndent = 0
    for (const line of lines) {
      const runMatch = line.match(/^(\s*)run: \|/)
      if (runMatch) { inRun = true; runIndent = runMatch[1].length; continue }
      if (inRun) {
        if (line.trim() === '') continue
        const indent = line.match(/^ */)[0].length
        if (indent <= runIndent) { inRun = false; continue }
        assert.ok(!line.includes('${{ github.event.inputs'), `inline event-inputs interpolation in run block: ${line.trim()}`)
        assert.ok(!line.includes('${{ inputs.'), `inline inputs interpolation in run block: ${line.trim()}`)
      }
    }
  })

  it('publish is gated on full generate success, manual publish defaults off', () => {
    const publishBlock = yml.slice(yml.indexOf('Publish live'))
    assert.match(publishBlock, /steps\.generate\.outcome == 'success'/)
    assert.match(publishBlock, /github\.event_name == 'schedule' \|\| inputs\.publish/)
    assert.match(yml, /type: boolean/)
  })

  it('report step always runs; telegram never uses continue-on-error', () => {
    const reportBlock = yml.slice(yml.indexOf('Factory report'))
    assert.match(reportBlock, /if: always\(\)/)
    assert.ok(!/^\s*continue-on-error:/m.test(yml), 'failures must stay visible — no continue-on-error key anywhere')
  })

  it('telegram step reads report outputs via env and checks HTTP + ok JSON', () => {
    const tgBlock = yml.slice(yml.indexOf('Alert operator'))
    assert.match(tgBlock, /GEN_REASON: \$\{\{ steps\.report\.outputs\.reason \}\}/)
    assert.match(tgBlock, /node scripts\/factory\/telegram-alert\.mjs/)
    const helper = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'factory', 'telegram-alert.mjs'), 'utf8')
    assert.match(helper, /body\?\.ok !== true/)
    assert.match(helper, /GITHUB_STEP_SUMMARY/)
  })
})
