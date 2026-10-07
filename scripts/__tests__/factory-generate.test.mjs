import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { fileURLToPath, pathToFileURL } from 'node:url'

import { runFactory } from '../factory/generate-article.mjs'
import { EXIT_PROVIDER_BALANCE } from '../factory/provider-errors.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const ARTICLE = {
  title: 'Testovaya statya',
  slug: 'testovaya-statya',
  description: 'Kratkoe opisanie statyi dlya testa.',
  tags: ['test'],
  quickAnswer: 'Kratkiy otvet dlya testa.',
  difficulty: 'Легко',
  time: '30 минут',
  cost: 'бесплатно',
  image_prompt: 'a realistic test photo',
  body_md: `Vvodnyy abzats. ${'Prakticheskiy sovet s tsiframi i delom. '.repeat(60)}`,
}

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'factory-gen-test-'))
}

function baseEnv(tmp, overrides = {}) {
  return {
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    FAL_KEY: 'test-fal-key',
    FACTORY_RESULT_PATH: path.join(tmp, 'result.json'),
    ...overrides,
  }
}

function makeAnthropic({ error = null, article = ARTICLE } = {}) {
  const calls = { create: 0 }
  return {
    calls,
    messages: {
      create: async () => {
        calls.create++
        if (error) throw error
        return { content: [{ type: 'text', text: JSON.stringify(article) }] }
      },
    },
  }
}

function makeFetch({ status = 200, body = null, error = null } = {}) {
  const calls = { count: 0 }
  const impl = async () => {
    calls.count++
    if (error) throw error
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body ?? {})),
      json: async () => (body ?? {}),
    }
  }
  return { fetchImpl: impl, calls }
}

function makeSb({ insertError = null, recent = [] } = {}) {
  const calls = { insert: 0, select: 0 }
  const sb = {
    from() {
      const chain = {
        select() { calls.select++; return chain },
        eq() { return chain },
        order() { return chain },
        limit() { return chain },
        then(resolve) { return Promise.resolve({ data: recent }).then(resolve) },
        insert: undefined,
      }
      chain.insert = async () => { calls.insert++; return { error: insertError } }
      return chain
    },
  }
  return { sb, calls }
}

function makeLogger() {
  const logs = []
  return { logger: { log: (s) => logs.push(String(s)), error: (s) => logs.push(String(s)) }, logs }
}

function readResult(tmp) {
  return JSON.parse(fs.readFileSync(path.join(tmp, 'result.json'), 'utf8'))
}

describe('runFactory — text provider outage', () => {
  it('halts --all after a real SDK-shaped Anthropic connection error', async () => {
    const tmp = makeTmp()
    const connection = new Error('Connection error.')
    connection.name = 'APIConnectionError'
    const anthropic = makeAnthropic({ error: connection })
    const { fetchImpl, calls: imageCalls } = makeFetch({ body: { images: [{ url: 'data:image/jpeg;base64,QUJD' }] } })
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()
    const result = await runFactory(['--all'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })
    assert.equal(result.exitCode, 1)
    assert.equal(result.failure.kind, 'unavailable')
    assert.equal(result.failure.provider, 'anthropic')
    assert.equal(result.failure.stage, 'text')
    assert.equal(result.counts.attempted, 1)
    assert.equal(result.counts.generated, 0)
    assert.equal(imageCalls.count, 0)
    assert.equal(sbCalls.insert, 0)
  })

  it('text balance error: exit 42, zero image calls, zero DB inserts, --all stops after one attempt', async () => {
    const tmp = makeTmp()
    const credit = new Error('400 {"error":{"message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}')
    credit.status = 400
    const anthropic = makeAnthropic({ error: credit })
    const { fetchImpl, calls: fetchCalls } = makeFetch({ body: { images: [{ url: 'data:image/jpeg;base64,QUJD' }] } })
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--all'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger,
      imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, EXIT_PROVIDER_BALANCE)
    assert.equal(result.failure.kind, 'balance')
    assert.equal(result.failure.provider, 'anthropic')
    assert.equal(result.failure.stage, 'text')
    assert.equal(result.halted, true)
    assert.equal(result.counts.requested, 12)
    assert.equal(result.counts.attempted, 1, 'batch must stop immediately on provider-wide outage')
    assert.equal(result.counts.generated, 0)
    assert.equal(fetchCalls.count, 0, 'no image call after text balance failure')
    assert.equal(sbCalls.insert, 0, 'no DB insert after text balance failure')
    // Machine-readable result JSON carries the same safe structured facts.
    const file = readResult(tmp)
    assert.equal(file.exitCode, 42)
    assert.equal(file.failure.reason, 'anthropic_balance')
    assert.equal(file.categories[0].provider, 'anthropic')
    assert.ok(!JSON.stringify(file).includes('credit balance is too low'), 'no raw provider payload in result JSON')
  })

  it('logs selected text provider/model and image provider/model separately', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl } = makeFetch({ body: { images: [{ url: 'data:image/jpeg;base64,QUJD' }] } })
    const { sb } = makeSb()
    const { logger, logs } = makeLogger()
    await runFactory(['--category', 'kulinaria', '--dry-run'], {
      env: baseEnv(tmp, { FACTORY_MODEL: 'claude-test-9', FAL_MODEL: 'fal-ai/test-model' }),
      anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })
    const sel = logs.find((l) => l.includes('[factory] text provider='))
    assert.ok(sel, 'selection log line present')
    assert.match(sel, /text provider=anthropic model=claude-test-9/)
    assert.match(sel, /image provider=fal model=fal-ai\/test-model/)
  })
})

describe('runFactory — image provider outage', () => {
  it('checks downloaded image HTTP status and records a safe fal/image outage before writing bytes', async () => {
    const tmp = makeTmp()
    let calls = 0
    const fetchImpl = async () => {
      calls++
      if (calls === 1) return { ok: true, status: 200, json: async () => ({ images: [{ url: 'https://fal.example/image.jpg' }] }) }
      return { ok: false, status: 503, text: async () => 'synthetic-secret-payload' }
    }
    const anthropic = makeAnthropic()
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()
    const result = await runFactory(['--category', 'kulinaria'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })
    assert.equal(result.failure.provider, 'fal')
    assert.equal(result.failure.stage, 'image')
    assert.equal(result.failure.kind, 'unavailable')
    assert.ok(!JSON.stringify(result).includes('synthetic-secret-payload'))
    assert.equal(sbCalls.insert, 0)
    assert.equal(fs.existsSync(path.join(tmp, 'testovaya-statya.jpg')), false)
  })

  it('image balance error: correct call-site attribution (fal/image), exit 42, no insert', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl } = makeFetch({ status: 402, body: '{"detail":"payment required"}' })
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--category', 'kulinaria'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(anthropic.calls.create, 1, 'text stage ran first')
    assert.equal(result.exitCode, 42)
    assert.equal(result.failure.kind, 'balance')
    assert.equal(result.failure.provider, 'fal')
    assert.equal(result.failure.stage, 'image')
    assert.equal(sbCalls.insert, 0)
    assert.equal(result.counts.generated, 0)
  })

  it('quota-bearing 429 from fal is balance and is NOT retried', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl, calls } = makeFetch({ status: 429, body: 'insufficient_quota: You exceeded your current quota' })
    const { sb } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--category', 'kulinaria'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, 42)
    assert.equal(result.failure.kind, 'balance')
    assert.equal(result.failure.provider, 'fal')
    assert.equal(calls.count, 1, 'balance failures must not retry')
  })

  it('transient fal 500 stays bounded-retryable then exits nonzero without insert', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl, calls } = makeFetch({ status: 500, body: 'upstream error' })
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--category', 'kulinaria'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, 1)
    assert.equal(result.failure.kind, 'unavailable', 'exhausted fal 5xx retries retain provider context and halt the batch')
    assert.equal(result.failure.provider, 'fal')
    assert.equal(result.halted, true)
    assert.equal(calls.count, 4, 'bounded retries (4 attempts)')
    assert.equal(sbCalls.insert, 0)
  })
})

describe('runFactory — generic failures', () => {
  it('generic DB insert failure is NOT attributed to anthropic and does not halt the batch', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl } = makeFetch({ body: { images: [{ url: 'data:image/jpeg;base64,QUJD' }] } })
    const { sb } = makeSb({ insertError: { message: 'duplicate key value violates unique constraint' } })
    const { logger } = makeLogger()

    const result = await runFactory(['--all'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, 1)
    assert.equal(result.failure.reason, 'database_operation_failed')
    assert.equal(result.counts.attempted, 12, 'per-category DB failures do not stop the batch')
    assert.equal(result.counts.generated, 0)
    assert.ok(result.categories.every((c) => c.provider === null), 'no provider attribution on DB errors')
    assert.equal(result.categories[0].stage, 'database')
  })

  it('content validation failure (short body) exits 1 without insert', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic({ article: { ...ARTICLE, body_md: 'too short' } })
    const { fetchImpl, calls } = makeFetch({ body: { images: [{ url: 'data:image/jpeg;base64,QUJD' }] } })
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--category', 'kulinaria'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, 1)
    assert.equal(calls.count, 0, 'short body fails before the image call')
    assert.equal(sbCalls.insert, 0)
  })
})

describe('runFactory — dry run and provider gate', () => {
  it('dry run has zero side effects (no text/image/db calls)', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl, calls } = makeFetch()
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--category', 'kulinaria', '--dry-run'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.ok, true)
    assert.equal(result.exitCode, 0)
    assert.equal(result.dryRun, true)
    assert.equal(anthropic.calls.create, 0)
    assert.equal(calls.count, 0)
    assert.equal(sbCalls.select, 0, 'dry run never pulls recent titles from DB')
  })

  it('unknown text provider is rejected even in dry-run, before any API/db work', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl, calls } = makeFetch()
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--category', 'kulinaria', '--dry-run'], {
      env: baseEnv(tmp, { FACTORY_TEXT_PROVIDER: 'openai' }),
      anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, 1)
    assert.equal(result.failure.reason, 'unsupported_text_provider')
    assert.equal(anthropic.calls.create, 0)
    assert.equal(calls.count, 0)
    assert.equal(sbCalls.select, 0)
  })

  it('unknown text provider with real run intent still performs zero calls', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl, calls } = makeFetch()
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--category', 'kulinaria'], {
      env: baseEnv(tmp, { FACTORY_TEXT_PROVIDER: 'some-fallback' }),
      anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, 1)
    assert.equal(result.failure.reason, 'unsupported_text_provider')
    assert.equal(anthropic.calls.create, 0)
    assert.equal(calls.count, 0)
    assert.equal(sbCalls.select, 0)
  })

  it('FAL_KEY is never counted as text config: missing ANTHROPIC_API_KEY fails with missing_config', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl } = makeFetch()
    const { sb } = makeSb()
    const { logger } = makeLogger()
    const env = baseEnv(tmp)
    delete env.ANTHROPIC_API_KEY

    const result = await runFactory(['--category', 'kulinaria'], {
      env, anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, 1)
    assert.equal(result.failure.reason, 'missing_config')
    assert.match(result.failure.action, /ANTHROPIC_API_KEY/)
    assert.equal(anthropic.calls.create, 0)
  })
})

describe('runFactory — happy path', () => {
  it('generates article, saves image, inserts row, exits 0, writes full result JSON', async () => {
    const tmp = makeTmp()
    const anthropic = makeAnthropic()
    const { fetchImpl } = makeFetch({ body: { images: [{ url: 'data:image/jpeg;base64,QUJD' }] } })
    const { sb, calls: sbCalls } = makeSb()
    const { logger } = makeLogger()

    const result = await runFactory(['--category', 'kulinaria'], {
      env: baseEnv(tmp), anthropic, fetchImpl, sb, logger, imagesDir: tmp, resultPath: path.join(tmp, 'result.json'),
    })

    assert.equal(result.exitCode, 0)
    assert.equal(result.ok, true)
    assert.equal(result.counts.generated, 1)
    assert.equal(sbCalls.insert, 1)
    assert.ok(fs.existsSync(path.join(tmp, 'testovaya-statya.jpg')), 'image written to imagesDir')
    const file = readResult(tmp)
    assert.equal(file.ok, true)
    assert.equal(file.textProvider, 'anthropic')
    assert.equal(file.imageProvider, 'fal')
    assert.equal(file.generated[0].slug, 'testovaya-statya')
  })
})

describe('module import safety', () => {
  it('importing the CLI module reads no env and performs no calls', () => {
    const tmp = makeTmp()
    // No keys, no provider config, isolated cwd — a main-path execution would
    // fail here; a bare import must succeed silently.
    const moduleUrl = pathToFileURL(path.join(REPO_ROOT, 'scripts', 'factory', 'generate-article.mjs')).href
    const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(moduleUrl)}); console.log('imported')`], {
      cwd: tmp,
      env: { PATH: process.env.PATH, FACTORY_RESULT_PATH: path.join(tmp, 'result.json') },
      encoding: 'utf8',
    })
    assert.equal(probe.status, 0, probe.stderr)
    assert.match(probe.stdout, /imported/)
    assert.equal(fs.existsSync(path.join(tmp, 'result.json')), false, 'import must not write a result file')
  })
})
