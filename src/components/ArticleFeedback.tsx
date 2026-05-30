'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

interface Props {
  slug: string
}

// Practical result signals (Problem C). Persisted to Supabase feedback_events;
// public aggregate tallies read from feedback_counters.
const SIGNALS = [
  { key: 'helped', label: '👍 Помогло' },
  { key: 'not_helped', label: '👎 Не помогло' },
  { key: 'tried', label: '🧪 Попробовал(а)' },
  { key: 'worked', label: '✅ Сработало' },
  { key: 'not_worked', label: '❌ Не сработало' },
  { key: 'want_try', label: '🔖 Хочу попробовать' },
] as const

type Counts = Record<string, number>

export default function ArticleFeedback({ slug }: Props) {
  const [signal, setSignal] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<'yes' | 'no' | null>(null)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [counts, setCounts] = useState<Counts>({})

  // Load aggregate counters (public) + restore this visitor's prior choices.
  const loadCounts = async () => {
    try {
      const sb = getSupabase()
      const { data } = await sb.from('feedback_counters').select('kind, count').eq('article_slug', slug)
      if (data) {
        const c: Counts = {}
        for (const row of data as { kind: string; count: number }[]) c[row.kind] = row.count
        setCounts(c)
      }
    } catch { /* offline */ }
  }

  useEffect(() => {
    try {
      setSignal(localStorage.getItem(`fb_signal_${slug}`))
      const v = localStorage.getItem(`fb_verdict_${slug}`)
      if (v === 'yes' || v === 'no') { setVerdict(v); setShowComment(true) }
      if (localStorage.getItem(`fb_sent_${slug}`) === '1') setSent(true)
    } catch {}
    loadCounts()
  }, [slug])

  // Record an event to Supabase (anon allowed); optimistic local count bump.
  const record = async (kind: string, extra: { comment?: string } = {}) => {
    setCounts((prev) => ({ ...prev, [kind]: (prev[kind] || 0) + 1 }))
    try {
      const sb = getSupabase()
      let userId: string | null = null
      try { const { data } = await sb.auth.getUser(); userId = data.user?.id ?? null } catch {}
      await sb.from('feedback_events').insert({ article_slug: slug, kind, comment: extra.comment || '', user_id: userId })
    } catch { /* best-effort; optimistic count already shown */ }
  }

  const pickSignal = (key: string) => {
    if (signal === key) return // one signal per visitor; don't double-count
    setSignal(key)
    try { localStorage.setItem(`fb_signal_${slug}`, key) } catch {}
    record(key)
  }

  const pickVerdict = (v: 'yes' | 'no') => {
    setVerdict(v); setShowComment(true)
    try { localStorage.setItem(`fb_verdict_${slug}`, v) } catch {}
    record(v === 'yes' ? 'verdict_yes' : 'verdict_no')
  }

  const submit = () => {
    if (comment.trim()) record('verdict_' + (verdict || 'no'), { comment: comment.trim() })
    try { localStorage.setItem(`fb_sent_${slug}`, '1') } catch {}
    setSent(true)
  }

  return (
    <section style={{ marginTop: '2.5rem', borderTop: '1px solid #f0ece7', paddingTop: '1.75rem' }}>
      {/* Practical signals with live aggregate counts */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.6rem' }}>
          Что у вас получилось?
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {SIGNALS.map((s) => {
            const active = signal === s.key
            const n = counts[s.key] || 0
            return (
              <button
                key={s.key}
                onClick={() => pickSignal(s.key)}
                aria-pressed={active}
                style={{
                  padding: '0.4rem 0.85rem', borderRadius: '999px', cursor: 'pointer',
                  border: active ? '2px solid #c0392b' : '2px solid #e0dbd5',
                  background: active ? '#c0392b0f' : '#faf9f7',
                  color: active ? '#c0392b' : '#555',
                  fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                {s.label}{n > 0 && <span style={{ marginLeft: '0.4rem', fontWeight: 700, color: active ? '#c0392b' : '#999' }}>{n}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Helped? Yes/No + improve textarea */}
      <div style={{ background: '#faf8f6', border: '1.5px solid #ede9e4', borderRadius: '12px', padding: '1.25rem' }}>
        {sent ? (
          <div style={{ textAlign: 'center', color: '#1e8449', fontWeight: 600, padding: '0.5rem 0' }}>
            🙏 Спасибо за отзыв!
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>Помогла ли статья?</span>
              <button onClick={() => pickVerdict('yes')} style={verdictBtn(verdict === 'yes', '#27ae60')}>
                Да{counts.verdict_yes ? ` · ${counts.verdict_yes}` : ''}
              </button>
              <button onClick={() => pickVerdict('no')} style={verdictBtn(verdict === 'no', '#c0392b')}>
                Нет{counts.verdict_no ? ` · ${counts.verdict_no}` : ''}
              </button>
            </div>

            {showComment && (
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.4rem' }}>
                  Что улучшить?
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={1000}
                  placeholder="Ваши пожелания…"
                  style={{
                    width: '100%', minHeight: '80px', boxSizing: 'border-box',
                    border: '1.5px solid #ddd', borderRadius: '8px', padding: '0.65rem 0.8rem',
                    fontSize: '0.92rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                  }}
                />
                <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                  <button onClick={submit} style={{
                    background: '#c0392b', color: '#fff', border: 'none', borderRadius: '8px',
                    padding: '0.55rem 1.4rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Отправить отзыв
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function verdictBtn(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '0.35rem 1.1rem', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
    border: `2px solid ${active ? color : '#ddd'}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : '#555',
    fontSize: '0.88rem', fontWeight: 700,
  }
}
