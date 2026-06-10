import { useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import bridge from '@vkontakte/vk-bridge'
import {
  View, Panel, PanelHeader, PanelHeaderBack, Group, Header, SimpleCell,
  Div, CardGrid, ContentCard, Button, Search, Placeholder, Footer, Banner, Spacing,
} from '@vkontakte/vkui'
import { content, imageUrl, articlesByCategory } from './data'
import type { Article } from './types'

type PanelId = 'onboarding' | 'home' | 'list' | 'article'
const ONBOARD_KEY = 'sovetydoma_vk_onboarded'

// Markdown renderers so article bodies keep their structure (headings, lists,
// paragraphs) instead of collapsing into one unreadable blob.
const mdComponents = {
  h1: (p: { children?: ReactNode }) => <h2 style={{ fontSize: 19, fontWeight: 800, margin: '22px 0 8px', lineHeight: 1.3 }}>{p.children}</h2>,
  h2: (p: { children?: ReactNode }) => <h2 style={{ fontSize: 19, fontWeight: 800, margin: '22px 0 8px', lineHeight: 1.3 }}>{p.children}</h2>,
  h3: (p: { children?: ReactNode }) => <h3 style={{ fontSize: 17, fontWeight: 700, margin: '18px 0 6px', lineHeight: 1.3 }}>{p.children}</h3>,
  h4: (p: { children?: ReactNode }) => <h4 style={{ fontSize: 16, fontWeight: 700, margin: '16px 0 6px' }}>{p.children}</h4>,
  p: (p: { children?: ReactNode }) => <p style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 14px' }}>{p.children}</p>,
  ul: (p: { children?: ReactNode }) => <ul style={{ margin: '0 0 14px', paddingLeft: 22, lineHeight: 1.6 }}>{p.children}</ul>,
  ol: (p: { children?: ReactNode }) => <ol style={{ margin: '0 0 14px', paddingLeft: 22, lineHeight: 1.6 }}>{p.children}</ol>,
  li: (p: { children?: ReactNode }) => <li style={{ margin: '0 0 6px', fontSize: 16 }}>{p.children}</li>,
  strong: (p: { children?: ReactNode }) => <strong style={{ fontWeight: 700 }}>{p.children}</strong>,
  a: (p: { href?: string; children?: ReactNode }) => <a href={p.href} target="_blank" rel="noreferrer" style={{ color: 'var(--vkui--color_text_link, #2688eb)' }}>{p.children}</a>,
  hr: () => <div style={{ height: 1, background: 'var(--vkui--color_separator_primary, #e3e3e3)', margin: '18px 0' }} />,
}

export function App() {
  const seen = (() => { try { return localStorage.getItem(ONBOARD_KEY) === '1' } catch { return false } })()
  const [history, setHistory] = useState<PanelId[]>(seen ? ['home'] : ['onboarding'])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeArticle, setActiveArticle] = useState<Article | null>(null)
  const [query, setQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const panel = history[history.length - 1]
  const go = (p: PanelId) => setHistory((h) => [...h, p])
  const back = () => setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h))

  const finishOnboarding = () => {
    try { localStorage.setItem(ONBOARD_KEY, '1') } catch { /* ignore */ }
    setHistory(['home'])
  }

  const openCategory = (slug: string) => { setActiveCategory(slug); setQuery(''); go('list') }
  const openArticle = (a: Article) => { setActiveArticle(a); go('article') }

  const listArticles = useMemo(() => {
    if (!activeCategory) return []
    const all = articlesByCategory(activeCategory)
    const q = query.trim().toLowerCase()
    return q ? all.filter((a) => (a.title + ' ' + a.description).toLowerCase().includes(q)) : all
  }, [activeCategory, query])

  const onRefresh = () => {
    setRefreshing(true)
    // Content is bundled; "refresh" is a UX affordance moderation expects.
    window.setTimeout(() => setRefreshing(false), 600)
  }

  const share = (url: string) => { bridge.send('VKWebAppShare', { link: url }).catch(() => {}) }

  const categoryName = activeCategory
    ? content.categories.find((c) => c.slug === activeCategory)?.name || ''
    : ''

  return (
    <View activePanel={panel}>
      <Panel id="onboarding">
        <PanelHeader>СоветыДома</PanelHeader>
        <Placeholder
          icon={<div style={{ fontSize: 56 }}>🏠</div>}
          title="1001 совет для дома"
          action={<Button size="l" onClick={finishOnboarding}>Начать</Button>}
        >
          Полезные советы и лайфхаки для дома, дачи, кухни, экономии и не только —
          {' '}{content.articles.length}+ статей в {content.categories.length} разделах.
        </Placeholder>
      </Panel>

      <Panel id="home">
        <PanelHeader>СоветыДома</PanelHeader>
        <Group header={<Header>Разделы</Header>}>
          {content.categories.map((c) => (
            <SimpleCell
              key={c.slug}
              onClick={() => openCategory(c.slug)}
              subtitle={c.description}
              indicator={String(c.count)}
            >
              {c.name}
            </SimpleCell>
          ))}
        </Group>
        <Footer>Все материалы — на 1001sovet.ru</Footer>
      </Panel>

      <Panel id="list">
        <PanelHeader before={<PanelHeaderBack onClick={back} />}>{categoryName}</PanelHeader>
        <Search value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск в разделе" />
        <Group>
          {listArticles.length === 0 ? (
            <Placeholder>Ничего не найдено</Placeholder>
          ) : (
            <CardGrid size="l">
              {listArticles.map((a) => (
                <ContentCard
                  key={a.slug}
                  src={imageUrl(a.image)}
                  title={a.title}
                  description={a.description}
                  caption={a.categoryName}
                  maxHeight={140}
                  onClick={() => openArticle(a)}
                />
              ))}
            </CardGrid>
          )}
        </Group>
        {refreshing && <Footer>Обновляем…</Footer>}
        <Spacing size={16} />
        <Div><Button mode="secondary" stretched onClick={onRefresh}>Обновить</Button></Div>
      </Panel>

      <Panel id="article">
        <PanelHeader before={<PanelHeaderBack onClick={back} />}>Статья</PanelHeader>
        {activeArticle && (
          <Group>
            {imageUrl(activeArticle.image) && (
              <img
                src={imageUrl(activeArticle.image)}
                alt={activeArticle.title}
                style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }}
              />
            )}
            <Div>
              <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 800, lineHeight: 1.25 }}>{activeArticle.title}</h1>
              <div style={{ opacity: 0.55, fontSize: 13, marginBottom: 14 }}>{activeArticle.categoryName}</div>
              <p style={{ fontSize: 16, lineHeight: 1.55, margin: '0 0 16px', fontWeight: 600 }}>{activeArticle.description}</p>
              <div className="vkapp-article-body">
                <ReactMarkdown components={mdComponents}>{activeArticle.body}</ReactMarkdown>
              </div>
            </Div>
            <Banner
              mode="tint"
              title="Полная версия статьи"
              subtitle="Откройте на сайте 1001sovet.ru — с фото, шагами и комментариями."
              actions={
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button href={activeArticle.url} target="_blank" rel="noreferrer">Читать на сайте</Button>
                  <Button mode="secondary" onClick={() => share(activeArticle.url)}>Поделиться</Button>
                </div>
              }
            />
            <Spacing size={24} />
          </Group>
        )}
      </Panel>
    </View>
  )
}
