'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import AdminShell from './AdminShell'
import { useAdminAuth } from '@/lib/admin-auth'
import {
  AdminApiError,
  getArticle,
  publishArticle,
  unpublishArticle,
  updateArticle,
  type AdminArticle,
} from '@/lib/admin-api'
import { CATEGORIES } from '@/lib/categories'

const CATEGORY_COLORS: Record<string, string> = {
  kulinaria: '#e67e22',
  'dom-i-uborka': '#27ae60',
  'dacha-i-ogorod': '#16a085',
  layfkhaki: '#8e44ad',
  ekonomiya: '#2980b9',
  rybalka: '#2c7da0',
  'zdorovie-i-bezopasnost': '#c0392b',
  'semya-i-deti': '#8e44ad',
  'krasota-i-uhod': '#e91e63',
  'otdyh-i-puteshestviya': '#2980b9',
  'pokupki-i-tehnika': '#f39c12',
  avto: '#34495e',
}

/* ------------------------------------------------------------------ */
/* Minimal Markdown preview (headings, lists, code fences, paragraphs, */
/* bold/italic/links). Deliberately dependency-free — the admin editor  */
/* only needs a rough visual check, not full MDX rendering.             */
/* ------------------------------------------------------------------ */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // **bold**, *italic*, [label](url)
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-${i}`}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={`${keyPrefix}-${i}`}>{tok.slice(1, -1)}</em>)
    } else {
      const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        nodes.push(
          <a key={`${keyPrefix}-${i}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: '#c0392b' }}>
            {linkMatch[1]}
          </a>,
        )
      } else {
        nodes.push(tok)
      }
    }
    last = m.index + tok.length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function MarkdownPreview({ source }: { source: string }) {
  const blocks: React.ReactNode[] = []
  const lines = source.split('\n')
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++ }
      i++ // skip closing fence
      blocks.push(
        <pre key={key++} style={{ background: '#f5f5f5', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.8rem', overflowX: 'auto', margin: '0.5rem 0' }}>
          {buf.join('\n')}
        </pre>,
      )
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const size = level === 1 ? '1.3rem' : level === 2 ? '1.15rem' : '1rem'
      blocks.push(
        <div key={key++} style={{ fontWeight: 700, fontSize: size, color: '#1a1a1a', margin: '0.9rem 0 0.35rem' }}>
          {renderInline(h[2], `h${key}`)}
        </div>,
      )
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++} style={{ margin: '0.35rem 0', paddingLeft: '1.4rem', fontSize: '0.88rem', color: '#333' }}>
          {items.map((it, j) => <li key={j}>{renderInline(it, `li${key}-${j}`)}</li>)}
        </ul>,
      )
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={key++} style={{ margin: '0.35rem 0', paddingLeft: '1.4rem', fontSize: '0.88rem', color: '#333' }}>
          {items.map((it, j) => <li key={j}>{renderInline(it, `ol${key}-${j}`)}</li>)}
        </ol>,
      )
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    blocks.push(
      <p key={key++} style={{ margin: '0.4rem 0', fontSize: '0.88rem', lineHeight: 1.6, color: '#333' }}>
        {renderInline(line, `p${key}`)}
      </p>,
    )
    i++
  }
  return <div>{blocks}</div>
}

/* ------------------------------------------------------------------ */

type BannerKind = 'success' | 'error' | 'info'
interface Banner {
  kind: BannerKind
  text: string
}

function bannerStyle(kind: BannerKind): React.CSSProperties {
  const map: Record<BannerKind, { bg: string; border: string; color: string }> = {
    success: { bg: '#f0fdf4', border: '#86efac', color: '#166534' },
    error: { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c' },
    info: { bg: '#eff6ff', border: '#93c5fd', color: '#1e40af' },
  }
  const s = map[kind]
  return {
    background: s.bg,
    border: `1px solid ${s.border}`,
    color: s.color,
    borderRadius: '8px',
    padding: '0.7rem 1rem',
    fontSize: '0.87rem',
    marginBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  }
}

function describeError(e: unknown): string {
  if (e instanceof AdminApiError) {
    return `${e.message} (${e.code}${e.status ? `, HTTP ${e.status}` : ''})`
  }
  return e instanceof Error ? e.message : 'Неизвестная ошибка'
}

export default function AdminArticleEditor() {
  const authState = useAdminAuth()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [article, setArticle] = useState<AdminArticle | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [bodyMd, setBodyMd] = useState('')
  const [showPreview, setShowPreview] = useState(true)

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [banner, setBanner] = useState<Banner | null>(null)

  // Idempotency keys: one per user-initiated mutation; reused only when the
  // user explicitly retries that same failed mutation.
  const saveKeyRef = useRef<string | null>(null)
  const publishKeyRef = useRef<string | null>(null)

  const applyArticle = useCallback((a: AdminArticle) => {
    setArticle(a)
    setTitle(a.title ?? '')
    setDescription(a.description ?? '')
    setBodyMd(a.body_md ?? '')
    setConflict(false)
  }, [])

  const load = useCallback(async () => {
    if (!id) return
    setLoadState('loading')
    setLoadError(null)
    try {
      applyArticle(await getArticle(id))
      setLoadState('ready')
    } catch (e) {
      console.error('[AdminArticleEditor] load failed', e)
      setLoadError(describeError(e))
      setLoadState('error')
    }
  }, [id, applyArticle])

  useEffect(() => {
    if (authState !== 'authed') return
    const tid = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(tid)
  }, [authState, load])

  async function handleSave(isRetry = false) {
    if (!article || saving) return
    if (!isRetry || !saveKeyRef.current) saveKeyRef.current = crypto.randomUUID()
    setSaving(true)
    setBanner(null)
    try {
      const updated = await updateArticle(
        article.id,
        { title: title.trim(), description: description.trim(), body_md: bodyMd },
        article.updated_at,
        saveKeyRef.current,
      )
      saveKeyRef.current = null
      applyArticle(updated)
      setBanner({ kind: 'success', text: `Сохранено. Ревизия ${updated.revision_count ?? '—'} · обновлено ${new Date(updated.updated_at).toLocaleString('ru-RU')}` })
    } catch (e) {
      console.error('[AdminArticleEditor] save failed', e)
      if (e instanceof AdminApiError && e.status === 409) {
        setConflict(true)
        setBanner(null)
      } else {
        setBanner({ kind: 'error', text: `Ошибка сохранения: ${describeError(e)}` })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish(action: 'publish' | 'unpublish', isRetry = false) {
    if (!article || publishing) return
    const question = action === 'publish'
      ? `Опубликовать «${article.title}»? Статья станет доступна на сайте без пересборки.`
      : `Снять «${article.title}» с публикации? Страница перестанет отдаваться сайтом.`
    if (!isRetry && !window.confirm(question)) return
    if (!isRetry || !publishKeyRef.current) publishKeyRef.current = crypto.randomUUID()
    setPublishing(true)
    setBanner(null)
    try {
      const fn = action === 'publish' ? publishArticle : unpublishArticle
      const res = await fn(article.id, publishKeyRef.current)
      publishKeyRef.current = null
      applyArticle(res.item)
      const purgeNote = res.purge_ok
        ? 'Кэш сайта очищен.'
        : '⚠️ Кэш сайта НЕ очищен (purge_ok=false) — изменения появятся с задержкой.'
      const verb = action === 'publish' ? 'Опубликовано.' : 'Снято с публикации.'
      setBanner({ kind: res.purge_ok ? 'success' : 'info', text: `${verb} ${purgeNote}` })
    } catch (e) {
      console.error(`[AdminArticleEditor] ${action} failed`, e)
      setBanner({ kind: 'error', text: `Ошибка: ${describeError(e)}` })
    } finally {
      setPublishing(false)
    }
  }

  if (authState !== 'authed') return null

  const catColor = article ? CATEGORY_COLORS[article.category] || '#888' : '#888'
  const catLabel = article ? CATEGORIES[article.category]?.name || article.category : ''
  const inFlight = saving || publishing

  return (
    <AdminShell activeNav="articles">
      <div style={{ padding: '2rem', maxWidth: '1100px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <Link
            href="/admin/articles/"
            style={{ color: '#888', textDecoration: 'none', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            ← Все статьи
          </Link>
          {article && (
            <>
              <span style={{ color: '#ddd' }}>|</span>
              <a
                href={`/${article.category}/${article.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '0.85rem',
                  color: '#c0392b',
                  textDecoration: 'none',
                  fontWeight: 600,
                  padding: '3px 10px',
                  border: '1px solid #f5c6c2',
                  borderRadius: '5px',
                  background: '#fff',
                }}
              >
                Открыть на сайте →
              </a>
            </>
          )}
        </div>

        {!id && (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '2.5rem', textAlign: 'center', color: '#b91c1c' }}>
            Не указан параметр ?id= — откройте статью из списка.
          </div>
        )}

        {id && loadState === 'loading' && (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '3rem', textAlign: 'center', color: '#aaa' }}>
            Загрузка статьи...
          </div>
        )}

        {id && loadState === 'error' && (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: '0.25rem' }}>Не удалось загрузить статью</div>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem' }}>{loadError}</div>
            <button
              onClick={load}
              style={{ padding: '0.55rem 1.25rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
            >
              Повторить
            </button>
          </div>
        )}

        {id && loadState === 'ready' && article && (
          <>
            {/* Title + badges */}
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1a1a', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
              {article.title}
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, color: catColor, background: catColor + '18' }}>
                {catLabel}
              </span>
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#1e40af', background: '#eff6ff' }}>
                {article.text_status}
              </span>
              <code style={{ fontFamily: 'monospace', fontSize: '0.8rem', background: '#f5f5f5', padding: '1px 6px', borderRadius: '3px', color: '#666' }}>
                {article.slug}
              </code>
              <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                рев. {article.revision_count ?? 0} · обновлено {new Date(article.updated_at).toLocaleString('ru-RU')}
              </span>
            </div>

            {/* Banners */}
            {conflict && (
              <div style={bannerStyle('error')}>
                <span><strong>Конфликт (409):</strong> статья была изменена кем-то ещё после того, как вы её открыли. Ваши правки не сохранены.</span>
                <button
                  onClick={load}
                  style={{ padding: '0.4rem 0.9rem', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                >
                  Загрузить актуальную версию
                </button>
              </div>
            )}
            {banner && (
              <div style={bannerStyle(banner.kind)}>
                <span>{banner.text}</span>
                {banner.kind === 'error' && !conflict && (
                  <button
                    onClick={() => (saveKeyRef.current ? handleSave(true) : handlePublish(article.text_status === 'published' ? 'unpublish' : 'publish', true))}
                    disabled={inFlight}
                    style={{ padding: '0.4rem 0.9rem', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', cursor: inFlight ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: inFlight ? 0.6 : 1 }}
                  >
                    Повторить
                  </button>
                )}
              </div>
            )}

            {/* Metadata form */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', background: '#f8f8f8' }}>
                <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Метаданные
                </h2>
              </div>
              <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Заголовок</span>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ padding: '0.6rem 0.85rem', border: '1.5px solid #e5e7eb', borderRadius: '7px', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Описание</span>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    style={{ padding: '0.6rem 0.85rem', border: '1.5px solid #e5e7eb', borderRadius: '7px', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </label>
              </div>
            </div>

            {/* Body editor + preview */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', background: '#f8f8f8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Текст (Markdown)
                </h2>
                <button
                  onClick={() => setShowPreview(v => !v)}
                  style={{ padding: '0.35rem 0.8rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', background: '#fff', color: '#666', fontFamily: 'inherit' }}
                >
                  {showPreview ? 'Скрыть предпросмотр' : 'Показать предпросмотр'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr' }}>
                <textarea
                  value={bodyMd}
                  onChange={e => setBodyMd(e.target.value)}
                  onKeyDown={e => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave()
                  }}
                  spellCheck={false}
                  style={{
                    minHeight: '480px',
                    padding: '1.25rem 1.5rem',
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.84rem',
                    lineHeight: 1.7,
                    fontFamily: "'Courier New', Consolas, monospace",
                    resize: 'vertical',
                    background: '#fdfdfd',
                  }}
                />
                {showPreview && (
                  <div style={{ borderLeft: '1px solid #f0f0f0', padding: '1.25rem 1.5rem', maxHeight: '480px', overflowY: 'auto', background: '#fff' }}>
                    <MarkdownPreview source={bodyMd} />
                  </div>
                )}
              </div>
            </div>

            {/* Frontmatter (read-only) */}
            <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0', background: '#f8f8f8' }}>
                <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Frontmatter (только чтение)
                </h2>
              </div>
              <pre style={{ margin: 0, padding: '1.25rem 1.5rem', fontSize: '0.8rem', lineHeight: 1.6, color: '#333', background: '#fafafa', overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', fontFamily: "'Courier New', Consolas, monospace" }}>
                {JSON.stringify(article.frontmatter ?? {}, null, 2)}
              </pre>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => handleSave()}
                disabled={inFlight}
                style={{ padding: '0.65rem 1.5rem', background: inFlight ? '#666' : '#1a1a1a', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '0.9rem', cursor: inFlight ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              {article.text_status === 'published' ? (
                <button
                  onClick={() => handlePublish('unpublish')}
                  disabled={inFlight}
                  style={{ padding: '0.65rem 1.5rem', background: '#fff', color: '#b91c1c', border: '1.5px solid #fca5a5', borderRadius: '7px', fontSize: '0.9rem', cursor: inFlight ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700, opacity: inFlight ? 0.6 : 1 }}
                >
                  {publishing ? 'Выполняется...' : 'Снять с публикации'}
                </button>
              ) : (
                <button
                  onClick={() => handlePublish('publish')}
                  disabled={inFlight}
                  style={{ padding: '0.65rem 1.5rem', background: inFlight ? '#86c99a' : '#15803d', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '0.9rem', cursor: inFlight ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}
                >
                  {publishing ? 'Выполняется...' : 'Опубликовать'}
                </button>
              )}
              <span style={{ fontSize: '0.78rem', color: '#bbb' }}>Ctrl+Enter — сохранить</span>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
