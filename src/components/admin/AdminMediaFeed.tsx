'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'
import {
  AdminApiError,
  listMedia,
  startMediaGeneration,
  assignMedia,
  applyMediaAndPublish,
  archiveMedia,
  rollbackMedia,
  getMediaJob,
  retryMediaJob,
  getArticleMedia,
  type MediaInventoryCard,
  type ArticleMediaVersion,
  type MediaGenerationJob,
} from '@/lib/admin-api'
import { CATEGORIES } from '@/lib/categories'
import { SUBSCRIPTION_CATEGORY_SLUGS } from '@/lib/subscriptions/constants.mjs'

const BATCH = 30
const UNDO_MS = 8000
const PRESETS = [
  { key: 'no_people', label: 'Без людей' },
  { key: 'no_text', label: 'Без текста' },
  { key: 'photorealism', label: 'Фотореализм' },
  { key: 'product', label: 'Предметка' },
  { key: 'safe', label: 'Безопасно' },
  { key: 'landscape_4_3', label: '4:3' },
] as const

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  live: { label: 'LIVE', color: '#15803d', bg: '#dcfce7' },
  candidate: { label: 'CANDIDATE', color: '#1e40af', bg: '#dbeafe' },
  generating: { label: 'GENERATING', color: '#a16207', bg: '#fef9c3' },
  failed: { label: 'FAILED', color: '#b91c1c', bg: '#fee2e2' },
  rejected: { label: 'REJECTED', color: '#7f1d1d', bg: '#fecaca' },
  archived: { label: 'ARCHIVED', color: '#6b7280', bg: '#f3f4f6' },
  none: { label: 'NO MEDIA', color: '#6b7280', bg: '#f3f4f6' },
}

type UndoAction = {
  label: string
  run: () => Promise<void>
  expires: number
}

function describeError(e: unknown): string {
  if (e instanceof AdminApiError) {
    return `${e.message} (${e.code}${e.status ? `, HTTP ${e.status}` : ''})`
  }
  return e instanceof Error ? e.message : 'Неизвестная ошибка'
}

function badge(status: string) {
  return STATUS_BADGE[status] || { label: status.toUpperCase(), color: '#555', bg: '#eee' }
}

export default function AdminMediaFeed() {
  const authState = useAdminAuth()
  const [items, setItems] = useState<MediaInventoryCard[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [boot, setBoot] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [category, setCategory] = useState('')
  const [articleStatus, setArticleStatus] = useState('')
  const [focusIdx, setFocusIdx] = useState(0)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [promptDraft, setPromptDraft] = useState<Record<string, string>>({})
  const [presets, setPresets] = useState<Record<string, string[]>>({})
  const [jobs, setJobs] = useState<Record<string, MediaGenerationJob>>({})
  const [undo, setUndo] = useState<UndoAction | null>(null)
  const [fullscreen, setFullscreen] = useState<{ a: string; b?: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350)
    return () => clearTimeout(t)
  }, [q])

  const resetAndLoad = useCallback(async () => {
    setBoot(true)
    setError(null)
    setItems([])
    setCursor(null)
    setHasMore(true)
    seenIds.current = new Set()
    setFocusIdx(0)
    try {
      const res = await listMedia({
        limit: BATCH,
        q: debouncedQ || undefined,
        category: category || undefined,
        status: articleStatus || undefined,
      })
      const unique: MediaInventoryCard[] = []
      for (const it of res.items) {
        if (seenIds.current.has(it.article.id)) continue
        seenIds.current.add(it.article.id)
        unique.push(it)
      }
      setItems(unique)
      setCursor(res.next_cursor)
      setHasMore(!!res.next_cursor)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBoot(false)
    }
  }, [debouncedQ, category, articleStatus])

  useEffect(() => {
    if (authState !== 'authed') return
    const id = window.setTimeout(() => { void resetAndLoad() }, 0)
    return () => window.clearTimeout(id)
  }, [authState, resetAndLoad])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !cursor) return
    setLoading(true)
    setError(null)
    try {
      const res = await listMedia({
        cursor,
        limit: BATCH,
        q: debouncedQ || undefined,
        category: category || undefined,
        status: articleStatus || undefined,
      })
      setItems((prev) => {
        const next = [...prev]
        for (const it of res.items) {
          if (seenIds.current.has(it.article.id)) continue
          seenIds.current.add(it.article.id)
          next.push(it)
        }
        return next
      })
      setCursor(res.next_cursor)
      setHasMore(!!res.next_cursor)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, cursor, debouncedQ, category, articleStatus])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore()
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [loadMore])

  const refreshCard = useCallback(async (articleId: string) => {
    const detail = await getArticleMedia(articleId)
    setItems((prev) => prev.map((it): MediaInventoryCard => {
      if (it.article.id !== articleId) return it
      const versions = detail.versions || []
      const live = detail.live
      const candidates = versions.filter((v) => v.status === 'candidate')
      let media_status = 'none'
      if (versions.some((v) => v.status === 'generating')) media_status = 'generating'
      else if (live) media_status = 'live'
      else if (candidates.length) media_status = 'candidate'
      else if (versions.some((v) => v.status === 'failed')) media_status = 'failed'
      const art = detail.article as Record<string, unknown>
      return {
        ...it,
        article: {
          ...it.article,
          title: String(art.title ?? it.article.title ?? ''),
          text_status: String(art.text_status ?? it.article.text_status ?? ''),
          image_filename: (art.image_filename as string | null | undefined) ?? it.article.image_filename,
          image_prompt: (art.image_prompt as string | null | undefined) ?? it.article.image_prompt,
          updated_at: String(art.updated_at ?? it.article.updated_at),
          active_media_id: (art.active_media_id as string | null | undefined) ?? it.article.active_media_id,
        },
        live,
        candidates,
        versions: versions.length ? versions : live ? [live] : [],
        media_status,
        public_image_url: live?.public_url || it.public_image_url,
      }
    }))
  }, [])

  const showUndo = useCallback((label: string, run: () => Promise<void>) => {
    setUndo({ label, run, expires: Date.now() + UNDO_MS })
  }, [])

  useEffect(() => {
    if (!undo) return
    const t = window.setTimeout(() => setUndo(null), Math.max(0, undo.expires - Date.now()))
    return () => window.clearTimeout(t)
  }, [undo])

  // Poll active jobs
  useEffect(() => {
    const active = Object.values(jobs).filter((j) => j.status === 'queued' || j.status === 'running')
    if (!active.length) return
    const t = window.setInterval(async () => {
      for (const j of active) {
        try {
          const res = await getMediaJob(j.id)
          setJobs((prev) => ({ ...prev, [j.id]: res.job }))
          if (res.job.status === 'succeeded' || res.job.status === 'failed') {
            await refreshCard(res.job.article_id)
          }
        } catch (e) {
          console.warn('[AdminMediaFeed] job poll failed', e)
        }
      }
    }, 2500)
    return () => window.clearInterval(t)
  }, [jobs, refreshCard])

  const runAction = useCallback(async (
    key: string,
    fn: () => Promise<void>,
    opts?: { undoLabel?: string; undo?: () => Promise<void> },
  ) => {
    setBusyKey(key)
    setToast(null)
    try {
      await fn()
      if (opts?.undo && opts.undoLabel) showUndo(opts.undoLabel, opts.undo)
    } catch (e) {
      setToast(describeError(e))
    } finally {
      setBusyKey(null)
    }
  }, [showUndo])

  const handleGenerate = useCallback(async (card: MediaInventoryCard) => {
    const id = card.article.id
    const prompt = promptDraft[id] ?? card.article.image_prompt ?? card.article.title ?? ''
    await runAction(`gen:${id}`, async () => {
      const res = await startMediaGeneration(id, {
        prompt,
        count: 2,
        presets: presets[id] || ['no_people', 'no_text', 'photorealism'],
      })
      setJobs((prev) => ({ ...prev, [res.job.id]: res.job }))
      setToast('Генерация запущена (2 кандидата)')
      await refreshCard(id)
    })
  }, [promptDraft, presets, runAction, refreshCard])

  const handleAssign = useCallback(async (card: MediaInventoryCard, media: ArticleMediaVersion, andPublish: boolean) => {
    if (!media.id) {
      setToast('Legacy media — сгенерируйте или загрузите новую версию для assign')
      return
    }
    const id = card.article.id
    await runAction(`assign:${media.id}`, async () => {
      const prevLiveId = card.live?.id
      const res = andPublish
        ? await applyMediaAndPublish(id, media.id!, card.article.updated_at)
        : await assignMedia(id, media.id!, card.article.updated_at)
      await refreshCard(id)
      const purgeNote = res.purge_ok === false ? ' · purge_ok=false' : res.purge_ok ? ' · purge ok' : ''
      setToast((andPublish ? 'Применено и опубликовано' : 'Применено') + purgeNote)
      if (prevLiveId && prevLiveId !== media.id) {
        showUndo('Откатить предыдущее', async () => {
          await rollbackMedia(id, prevLiveId, undefined)
          await refreshCard(id)
        })
      }
    })
  }, [runAction, refreshCard, showUndo])

  const handleArchive = useCallback(async (card: MediaInventoryCard, media: ArticleMediaVersion | null) => {
    const target = media || card.live
    if (!target?.id) {
      setToast('Нечего архивировать (нет versioned media id)')
      return
    }
    const id = card.article.id
    await runAction(`arch:${target.id}`, async () => {
      await archiveMedia(id, target.id!)
      await refreshCard(id)
      setToast('Медиа отвязано / archived (R2 object сохранён)')
      showUndo('Откатить', async () => {
        await rollbackMedia(id, target.id!)
        await refreshCard(id)
      })
    })
  }, [runAction, refreshCard, showUndo])

  // Keyboard shortcuts
  useEffect(() => {
    if (authState !== 'authed') return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        setFocusIdx((i) => Math.min(items.length - 1, i + 1))
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        setFocusIdx((i) => Math.max(0, i - 1))
      } else if (e.key === 'a' || e.key === 'A') {
        const card = items[focusIdx]
        const cand = card?.candidates[0]
        if (card && cand) void handleAssign(card, cand, false)
      } else if (e.key === 'r' || e.key === 'R') {
        const card = items[focusIdx]
        if (card) void handleGenerate(card)
      } else if (e.key === 'x' || e.key === 'X') {
        const card = items[focusIdx]
        if (card) void handleArchive(card, card.live)
      } else if (e.key === 'p' || e.key === 'P') {
        const card = items[focusIdx]
        const cand = card?.candidates[0] || card?.live
        if (card && cand) void handleAssign(card, cand, true)
      } else if (e.key === 'z' || e.key === 'Z') {
        if (undo) void undo.run().then(() => setUndo(null))
      } else if (e.key === ' ') {
        e.preventDefault()
        const card = items[focusIdx]
        if (card) {
          setFullscreen({
            a: card.public_image_url || '',
            b: card.candidates[0]?.public_url || undefined,
          })
        }
      } else if (e.key === 'Escape') {
        setFullscreen(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [authState, items, focusIdx, handleAssign, handleGenerate, handleArchive, undo])

  useEffect(() => {
    cardRefs.current.get(focusIdx)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusIdx])

  const categories = useMemo(() => SUBSCRIPTION_CATEGORY_SLUGS as string[], [])

  if (authState !== 'authed') return null

  return (
    <AdminShell activeNav="media">
      <div style={{ padding: '1.25rem 1.5rem 4rem', maxWidth: '920px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#1a1a1a' }}>Медиа статей</h1>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Беглая проверка hero · J/K карточки · A принять · R regenerate · X убрать · P publish · Z undo · Space compare
            </p>
          </div>
          <Link href="/admin/photos/" style={{ fontSize: '0.85rem', color: '#c0392b', fontWeight: 600, alignSelf: 'center' }}>
            Фото читателей →
          </Link>
        </div>

        <div style={{
          background: '#fff', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', gap: '0.6rem', flexWrap: 'wrap',
        }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск title / slug..."
            style={{ flex: '1 1 180px', padding: '0.5rem 0.75rem', border: '1px solid #e5e5e5', borderRadius: '7px', fontFamily: 'inherit' }}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            style={{ padding: '0.5rem 0.6rem', border: '1px solid #e5e5e5', borderRadius: '7px', fontFamily: 'inherit' }}>
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c} value={c}>{CATEGORIES[c]?.name || c}</option>
            ))}
          </select>
          <select value={articleStatus} onChange={(e) => setArticleStatus(e.target.value)}
            style={{ padding: '0.5rem 0.6rem', border: '1px solid #e5e5e5', borderRadius: '7px', fontFamily: 'inherit' }}>
            <option value="">Все статусы статей</option>
            <option value="published">published</option>
            <option value="unpublished">unpublished</option>
            <option value="draft">draft</option>
            <option value="approved">approved</option>
          </select>
        </div>

        {toast && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', padding: '0.65rem 0.9rem', marginBottom: '0.75rem', fontSize: '0.87rem' }}>
            {toast}
            <button type="button" onClick={() => setToast(null)} style={{ float: 'right', border: 'none', background: 'transparent', cursor: 'pointer', color: '#991b1b' }}>✕</button>
          </div>
        )}
        {error && (
          <div style={{ background: '#fff', border: '1px solid #fca5a5', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: '0.35rem' }}>Ошибка загрузки</div>
            <div style={{ color: '#666', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</div>
            <button type="button" onClick={() => void resetAndLoad()}
              style={{ padding: '0.45rem 1rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              Повторить
            </button>
          </div>
        )}

        {boot && <div style={{ color: '#aaa', padding: '2rem', textAlign: 'center' }}>Загрузка inventory…</div>}

        {!boot && items.length === 0 && !error && (
          <div style={{ color: '#999', padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: '10px' }}>
            Нет статей по фильтрам
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((card, idx) => {
            const focusedCard = idx === focusIdx
            const live = card.live
            const img = card.public_image_url || live?.public_url
            const st = badge(card.media_status)
            const articleId = card.article.id
            const activeJob = Object.values(jobs).find(
              (j) => j.article_id === articleId && (j.status === 'queued' || j.status === 'running'),
            )
            const failedJob = Object.values(jobs).find(
              (j) => j.article_id === articleId && j.status === 'failed',
            )
            const draft = promptDraft[articleId] ?? card.article.image_prompt ?? ''
            const cardPresets = presets[articleId] || ['no_people', 'no_text', 'photorealism']
            return (
              <div
                key={articleId}
                ref={(el) => { if (el) cardRefs.current.set(idx, el); else cardRefs.current.delete(idx) }}
                onClick={() => setFocusIdx(idx)}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  boxShadow: focusedCard ? '0 0 0 2px #c0392b' : '0 1px 4px rgba(0,0,0,0.08)',
                  overflow: 'hidden',
                  outline: focusedCard ? '2px solid #c0392b33' : 'none',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', gap: 0 }}>
                  <div style={{ background: '#111', minHeight: '220px', position: 'relative' }}>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={live?.alt || card.article.title || ''}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', maxHeight: '340px', background: '#111' }}
                      />
                    ) : (
                      <div style={{ color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '220px' }}>Нет изображения</div>
                    )}
                    <span style={{
                      position: 'absolute', top: 10, left: 10, padding: '2px 8px', borderRadius: 4,
                      fontSize: '0.72rem', fontWeight: 800, color: st.color, background: st.bg,
                    }}>{st.label}</span>
                  </div>

                  <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1a1a1a', lineHeight: 1.3 }}>
                      <Link href={`/admin/article/?id=${encodeURIComponent(articleId)}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {card.article.title}
                      </Link>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#888', fontFamily: 'monospace' }}>
                      {card.article.category}/{card.article.slug} · {card.article.text_status}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#555' }}>
                      source: {live?.source || card.article.image_source || '—'} · provider: {live?.provider || card.article.image_model || '—'}
                      {live?.width && live?.height ? ` · ${live.width}×${live.height}` : ''}
                      {live?.mime ? ` · ${live.mime}` : ''}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#666' }}>
                      version: {live?.version ?? '—'} · key: <code style={{ fontSize: '0.72rem' }}>{live?.storage_key || card.article.image_filename || '—'}</code>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#444', maxHeight: '3.2em', overflow: 'hidden' }}>
                      prompt: {draft || '—'}
                    </div>

                    {card.candidates.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingTop: '0.25rem' }}>
                        {card.candidates.map((c) => (
                          <button
                            key={String(c.id)}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleAssign(card, c, false) }}
                            title="Принять и применить"
                            style={{ border: '2px solid #93c5fd', borderRadius: 6, padding: 0, background: '#eff6ff', cursor: 'pointer', flex: '0 0 auto' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.public_url || ''} alt="candidate" width={72} height={54} style={{ objectFit: 'cover', display: 'block', borderRadius: 4 }} />
                          </button>
                        ))}
                      </div>
                    )}

                    {activeJob && (
                      <div style={{ fontSize: '0.8rem', color: '#a16207', background: '#fef9c3', padding: '0.35rem 0.5rem', borderRadius: 6 }}>
                        Job {activeJob.status} · {activeJob.progress ?? 0}% · attempt {activeJob.attempt ?? 0}
                      </div>
                    )}
                    {failedJob && (
                      <div style={{ fontSize: '0.8rem', color: '#b91c1c', background: '#fee2e2', padding: '0.35rem 0.5rem', borderRadius: 6, display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                        <span>FAIL: {failedJob.error_code || 'error'} — {failedJob.error_message || ''}</span>
                        {failedJob.retryable !== false && (
                          <button
                            type="button"
                            disabled={busyKey === `retry:${failedJob.id}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              void runAction(`retry:${failedJob.id}`, async () => {
                                await retryMediaJob(failedJob.id)
                                setJobs((prev) => ({ ...prev, [failedJob.id]: { ...failedJob, status: 'queued', progress: 0 } }))
                              })
                            }}
                            style={{ border: 'none', background: '#b91c1c', color: '#fff', borderRadius: 4, padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    )}

                    <textarea
                      value={draft}
                      onChange={(e) => setPromptDraft((p) => ({ ...p, [articleId]: e.target.value }))}
                      onClick={(e) => e.stopPropagation()}
                      rows={2}
                      placeholder="Prompt для генерации"
                      style={{ width: '100%', fontSize: '0.8rem', border: '1px solid #e5e5e5', borderRadius: 6, padding: '0.4rem 0.5rem', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {PRESETS.map((p) => {
                        const on = cardPresets.includes(p.key)
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPresets((prev) => {
                                const cur = prev[articleId] || ['no_people', 'no_text', 'photorealism']
                                const next = on ? cur.filter((x) => x !== p.key) : [...cur, p.key]
                                return { ...prev, [articleId]: next }
                              })
                            }}
                            style={{
                              fontSize: '0.7rem', padding: '2px 7px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
                              border: on ? '1px solid #c0392b' : '1px solid #ddd',
                              background: on ? '#c0392b12' : '#fafafa', color: on ? '#c0392b' : '#666', fontWeight: 600,
                            }}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                      <ActionBtn disabled={!!busyKey} onClick={() => {
                        const c = card.candidates[0]
                        if (c) void handleAssign(card, c, false)
                        else setToast('Нет кандидата — сначала generate')
                      }}>✓ Принять и применить</ActionBtn>
                      <ActionBtn disabled={!!busyKey} onClick={() => void handleGenerate(card)}>↻ 2 новых</ActionBtn>
                      <ActionBtn disabled={!!busyKey} onClick={() => void handleArchive(card, card.live)}>× Убрать</ActionBtn>
                      <ActionBtn disabled={!!busyKey} onClick={() => {
                        const archived = card.versions.find((v) => v.status === 'archived' && v.id)
                        if (archived?.id) void handleAssign(card, archived, false)
                        else setToast('Нет archived version для отката')
                      }}>⟲ Откатить</ActionBtn>
                      <ActionBtn disabled={!!busyKey} primary onClick={() => {
                        const c = card.candidates[0] || card.live
                        if (c) void handleAssign(card, c, true)
                      }}>
                        {card.article.text_status === 'published' ? 'Применить сейчас' : 'Применить + опубликовать'}
                      </ActionBtn>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div ref={sentinelRef} style={{ height: 1 }} />
        {loading && <div style={{ textAlign: 'center', color: '#aaa', padding: '1rem' }}>Загрузка…</div>}
        {!hasMore && items.length > 0 && <div style={{ textAlign: 'center', color: '#bbb', padding: '1rem', fontSize: '0.85rem' }}>Конец списка</div>}

        {undo && (
          <div style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#1a1a1a', color: '#fff', padding: '0.7rem 1rem', borderRadius: 10,
            display: 'flex', gap: '0.75rem', alignItems: 'center', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
            <span style={{ fontSize: '0.88rem' }}>{undo.label}</span>
            <button type="button" onClick={() => { void undo.run().then(() => setUndo(null)) }}
              style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 6, padding: '0.35rem 0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Undo
            </button>
          </div>
        )}

        {fullscreen && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setFullscreen(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1rem' }}
          >
            {fullscreen.a && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fullscreen.a} alt="current" style={{ maxWidth: fullscreen.b ? '46vw' : '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
            )}
            {fullscreen.b && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fullscreen.b} alt="candidate" style={{ maxWidth: '46vw', maxHeight: '90vh', objectFit: 'contain' }} />
            )}
          </div>
        )}
      </div>
      <style>{`
        @media (max-width: 720px) {
          div[style*="grid-template-columns: minmax(0, 1.1fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </AdminShell>
  )
}

function ActionBtn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        padding: '0.35rem 0.55rem',
        fontSize: '0.75rem',
        fontWeight: 700,
        borderRadius: 6,
        border: primary ? 'none' : '1px solid #ddd',
        background: primary ? '#c0392b' : '#fff',
        color: primary ? '#fff' : '#333',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}
