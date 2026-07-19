'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AdminApiError,
  getArticleMedia,
  startMediaGeneration,
  assignMedia,
  applyMediaAndPublish,
  archiveMedia,
  type ArticleMediaVersion,
  type MediaGenerationJob,
} from '@/lib/admin-api'

function describeError(e: unknown): string {
  if (e instanceof AdminApiError) {
    return `${e.message} (${e.code}${e.status ? `, HTTP ${e.status}` : ''})`
  }
  return e instanceof Error ? e.message : 'Неизвестная ошибка'
}

interface Props {
  articleId: string
  updatedAt: string
  textStatus: string
  onArticleMutated?: () => void
}

export default function AdminArticleMediaPanel({ articleId, updatedAt, textStatus, onArticleMutated }: Props) {
  const [live, setLive] = useState<ArticleMediaVersion | null>(null)
  const [versions, setVersions] = useState<ArticleMediaVersion[]>([])
  const [jobs, setJobs] = useState<MediaGenerationJob[]>([])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getArticleMedia(articleId)
      setLive(res.live)
      setVersions(res.versions || [])
      setJobs(res.jobs || [])
      setPrompt(String(res.article.image_prompt || res.live?.prompt || res.article.title || ''))
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(false)
    }
  }, [articleId])

  useEffect(() => {
    const id = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(id)
  }, [load])

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true)
    setMsg(null)
    setError(null)
    try {
      await fn()
      await load()
      onArticleMutated?.()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const candidates = versions.filter((v) => v.status === 'candidate')
  const img = live?.public_url

  return (
    <section style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      padding: '1rem 1.15rem',
      marginBottom: '1.25rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1a1a1a' }}>Hero / Медиа</h2>
        <Link href="/admin/media/" style={{ fontSize: '0.82rem', color: '#c0392b', fontWeight: 600 }}>Открыть ленту медиа →</Link>
      </div>

      {loading && <div style={{ color: '#aaa', fontSize: '0.88rem' }}>Загрузка медиа…</div>}
      {error && <div style={{ color: '#b91c1c', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
      {msg && <div style={{ color: '#166534', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{msg}</div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '1rem' }}>
          <div style={{ background: '#111', borderRadius: 8, overflow: 'hidden', minHeight: 120 }}>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={live?.alt || 'hero'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ color: '#666', fontSize: '0.8rem', padding: '2rem 0.5rem', textAlign: 'center' }}>нет hero</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>
              status: <strong>{live?.status || 'none'}</strong>
              {live?.storage_key ? <> · <code style={{ fontSize: '0.75rem' }}>{live.storage_key}</code></> : null}
              {live?.version != null ? <> · v{live.version}</> : null}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              style={{ width: '100%', fontSize: '0.82rem', border: '1px solid #e5e5e5', borderRadius: 6, padding: '0.4rem 0.55rem', fontFamily: 'inherit' }}
              placeholder="Prompt"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <button type="button" disabled={busy} onClick={() => void withBusy(async () => {
                await startMediaGeneration(articleId, { prompt, count: 2, presets: ['no_people', 'no_text', 'photorealism'] })
                setMsg('Генерация 2 кандидатов запущена')
              })} style={btnStyle}>↻ Сгенерировать 2</button>
              {candidates[0]?.id && (
                <button type="button" disabled={busy} onClick={() => void withBusy(async () => {
                  const res = await assignMedia(articleId, candidates[0].id!, updatedAt)
                  setMsg(res.purge_ok === false ? 'Применено, purge_ok=false' : 'Кандидат применён')
                })} style={btnStyle}>✓ Применить кандидата</button>
              )}
              {live?.id && (
                <button type="button" disabled={busy} onClick={() => void withBusy(async () => {
                  await archiveMedia(articleId, live.id!)
                  setMsg('Отвязано (archived)')
                })} style={btnStyle}>× Убрать</button>
              )}
              {(candidates[0] || live)?.id && (
                <button type="button" disabled={busy} onClick={() => void withBusy(async () => {
                  const m = candidates[0] || live!
                  const res = await applyMediaAndPublish(articleId, m.id!, updatedAt)
                  setMsg(res.purge_ok === false ? 'Publish+apply, purge_ok=false' : 'Применено + опубликовано')
                })} style={{ ...btnStyle, background: '#c0392b', color: '#fff', border: 'none' }}>
                  {textStatus === 'published' ? 'Применить сейчас' : 'Применить + опубликовать'}
                </button>
              )}
            </div>
            {candidates.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {candidates.map((c) => (
                  <button key={String(c.id)} type="button" disabled={busy} onClick={() => void withBusy(async () => {
                    await assignMedia(articleId, c.id!, updatedAt)
                    setMsg('Кандидат назначен LIVE')
                  })} style={{ border: '1px solid #93c5fd', borderRadius: 6, padding: 0, cursor: 'pointer', background: '#eff6ff' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.public_url || ''} alt="cand" width={64} height={48} style={{ objectFit: 'cover', display: 'block', borderRadius: 5 }} />
                  </button>
                ))}
              </div>
            )}
            {jobs[0] && (
              <div style={{ fontSize: '0.78rem', color: '#666' }}>
                last job: {jobs[0].status} {jobs[0].progress != null ? `${jobs[0].progress}%` : ''}
                {jobs[0].error_code ? ` · ${jobs[0].error_code}` : ''}
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 640px) {
          section > div[style*="grid-template-columns: 160px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.4rem 0.7rem',
  fontSize: '0.78rem',
  fontWeight: 700,
  borderRadius: 6,
  border: '1px solid #ddd',
  background: '#fff',
  color: '#333',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
