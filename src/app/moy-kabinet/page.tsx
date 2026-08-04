'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getArticleMeta } from '@/lib/article-index'
import { photoPublicUrl } from '@/lib/photos'
import ArticlePageShell from '@/components/ArticlePageShell'
import LatestPublished from '@/components/LatestPublished'

interface SavedArticle {
  article_slug: string
  saved_at: string
}

interface UserArticle {
  id: string
  title: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  created_at: string
  category: string
  photo_path?: string | null
}

type CabinetTab = 'feed' | 'recipes' | 'lifehacks' | 'saved' | 'articles'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Черновик', color: '#666', bg: '#f0ede8' },
  pending: { label: 'На проверке', color: '#e67e22', bg: '#fef3e2' },
  approved: { label: 'Опубликовано', color: '#27ae60', bg: '#e9f7ef' },
  rejected: { label: 'Отклонено', color: '#c0392b', bg: '#fdecea' },
}

const TABS: Array<{ id: CabinetTab; label: string }> = [
  { id: 'feed', label: 'Лента' },
  { id: 'recipes', label: 'Рецепты' },
  { id: 'lifehacks', label: 'Лайфхаки' },
  { id: 'saved', label: 'Сохранённое' },
  { id: 'articles', label: 'Мои статьи' },
]

export default function MoyKabinetPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<CabinetTab>('feed')
  const [saved, setSaved] = useState<SavedArticle[]>([])
  const [articles, setArticles] = useState<UserArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (cancelled) return
        const user = data.user
        if (!user) {
          router.replace('/')
          return
        }
        setUserId(user.id)

        const [savedResult, articlesResult] = await Promise.all([
          supabase
            .from('saved_articles')
            .select('*')
            .eq('user_id', user.id)
            .order('saved_at', { ascending: false }),
          supabase
            .from('user_articles')
            .select('*')
            .eq('author_id', user.id)
            .order('created_at', { ascending: false }),
        ])

        if (!cancelled) {
          setSaved((savedResult.data as SavedArticle[]) || [])
          setArticles((articlesResult.data as UserArticle[]) || [])
          setLoading(false)
          setLoadingError(null)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('moy-kabinet load error', error)
          setLoadingError('Не удалось загрузить ленту. Попробуйте обновить страницу.')
          setLoading(false)
        }
      }
    })()

    return () => { cancelled = true }
  }, [router])

  const removeSaved = async (slug: string) => {
    if (!userId) return
    await supabase.from('saved_articles').delete().eq('user_id', userId).eq('article_slug', slug)
    setSaved((prev) => prev.filter((article) => article.article_slug !== slug))
  }

  if (loading) {
    return <div style={pageMessageStyle}>Загрузка ленты…</div>
  }

  if (loadingError) {
    return (
      <div style={pageMessageStyle}>
        <p style={{ color: '#c0392b', marginBottom: '1rem' }}>{loadingError}</p>
        <button onClick={() => window.location.reload()} style={redBtnStyle}>Обновить страницу</button>
      </div>
    )
  }

  return (
    <ArticlePageShell>
      <main style={{ maxWidth: '1040px', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
        <header style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontSize: '1.55rem', fontWeight: 850, color: '#1a1a1a', margin: '0 0 0.3rem' }}>
            Моя лента
          </h1>
          <p style={{ color: '#777', fontSize: '0.93rem', margin: 0, lineHeight: 1.5 }}>
            Самые свежие рецепты, лайфхаки и полезные советы.
          </p>
        </header>

        <nav aria-label="Разделы кабинета" style={tabBarStyle}>
          {TABS.map((item) => {
            const active = tab === item.id
            const count = item.id === 'saved' ? saved.length : item.id === 'articles' ? articles.length : null
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-current={active ? 'page' : undefined}
                style={{ ...tabStyle, color: active ? '#c0392b' : '#666', borderBottomColor: active ? '#c0392b' : 'transparent' }}
              >
                {item.label}{count === null ? '' : ` (${count})`}
              </button>
            )
          })}
        </nav>

        {tab === 'feed' && (
          <LatestPublished
            limit={12}
            title="Самое свежее"
            subtitle="Только что опубликованные материалы со всего сайта"
            showEmpty
          />
        )}

        {tab === 'recipes' && (
          <LatestPublished
            category="kulinaria"
            limit={12}
            title="Свежие рецепты"
            subtitle="Новые блюда, заготовки и кулинарные советы"
            showEmpty
            emptyHref="/kulinaria/"
            emptyLinkLabel="Открыть все рецепты →"
          />
        )}

        {tab === 'lifehacks' && (
          <LatestPublished
            category="layfkhaki"
            limit={12}
            title="Свежие лайфхаки"
            subtitle="Новые практичные идеи для дома и повседневной жизни"
            showEmpty
            emptyHref="/layfkhaki/"
            emptyLinkLabel="Открыть все лайфхаки →"
          />
        )}

        {tab === 'saved' && <SavedArticles saved={saved} onRemove={removeSaved} />}
        {tab === 'articles' && <AuthoredArticles articles={articles} />}
      </main>
    </ArticlePageShell>
  )
}

function SavedArticles({ saved, onRemove }: { saved: SavedArticle[]; onRemove: (slug: string) => void }) {
  if (saved.length === 0) {
    return (
      <EmptyState message="Пока нет сохранённых статей" href="/" linkLabel="Открыть ленту →" />
    )
  }

  return (
    <section aria-label="Сохранённые статьи" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {saved.map((item) => {
        const meta = getArticleMeta(item.article_slug)
        const href = meta?.category ? `/${meta.category}/${item.article_slug}/` : `/search/?q=${encodeURIComponent(item.article_slug)}`
        return (
          <article key={item.article_slug} style={savedCardStyle}>
            <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>🔖</span>
            <Link href={href} style={{ flex: 1, color: '#1a1a1a', textDecoration: 'none', fontWeight: 650, fontSize: '0.95rem' }}>
              {meta?.title || item.article_slug}
            </Link>
            <button type="button" onClick={() => onRemove(item.article_slug)} aria-label="Удалить из сохранённого" style={removeButtonStyle}>×</button>
          </article>
        )
      })}
    </section>
  )
}

function AuthoredArticles({ articles }: { articles: UserArticle[] }) {
  if (articles.length === 0) {
    return <EmptyState message="Вы ещё не писали статей" href="/napisat/" linkLabel="Написать статью →" />
  }

  return (
    <section aria-label="Мои статьи">
      <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
        <Link href="/napisat/" style={redBtnStyle}>✏️ Написать статью</Link>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {articles.map((article) => {
          const status = STATUS_LABELS[article.status] || STATUS_LABELS.draft
          return (
            <article key={article.id} style={savedCardStyle}>
              {article.photo_path && (
                // eslint-disable-next-line @next/next/no-img-element -- private R2 key is resolved at runtime.
                <img src={photoPublicUrl(article.photo_path)} alt="Фотография рецепта" style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '7px', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 650, fontSize: '0.95rem', color: '#1a1a1a', marginBottom: '0.25rem' }}>{article.title}</div>
                <div style={{ fontSize: '0.78rem', color: '#888' }}>{article.category} · {new Date(article.created_at).toLocaleDateString('ru-RU')}</div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, color: status.color, backgroundColor: status.bg }}>{status.label}</span>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function EmptyState({ message, href, linkLabel }: { message: string; href: string; linkLabel: string }) {
  return (
    <div style={{ textAlign: 'center', color: '#888', padding: '3rem 0' }}>
      <p style={{ marginBottom: '1rem' }}>{message}</p>
      <Link href={href} style={{ color: '#c0392b', fontWeight: 650 }}>{linkLabel}</Link>
    </div>
  )
}

const pageMessageStyle: React.CSSProperties = {
  maxWidth: '800px', margin: '4rem auto', padding: '0 1rem', textAlign: 'center', color: '#888',
}
const tabBarStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: '0 0.35rem', borderBottom: '2px solid #f0ede8', marginBottom: '1.75rem',
}
const tabStyle: React.CSSProperties = {
  background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', padding: '0.65rem 0.8rem', marginBottom: '-2px', fontSize: '0.92rem', fontWeight: 700, fontFamily: 'inherit',
}
const savedCardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #e8e4df', borderRadius: '10px', padding: '0.95rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
}
const removeButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.25rem', lineHeight: 1, padding: '2px 6px',
}
const redBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#c0392b', color: '#fff', border: 'none', borderRadius: '7px', padding: '0.5rem 1.1rem', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
}
