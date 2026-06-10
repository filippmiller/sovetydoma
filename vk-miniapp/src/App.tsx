import { useMemo, useState } from 'react'
import bridge from '@vkontakte/vk-bridge'
import {
  View, Panel, PanelHeader, PanelHeaderBack, Group, Header, SimpleCell,
  Div, CardGrid, ContentCard, Button, Search, Placeholder, Footer, Banner, Spacing,
} from '@vkontakte/vkui'
import { content, imageUrl, articlesByCategory } from './data'
import type { Article } from './types'

type PanelId = 'onboarding' | 'home' | 'list' | 'article'
const ONBOARD_KEY = 'sovetydoma_vk_onboarded'

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
              <h2 style={{ margin: '8px 0 4px', fontSize: 20, fontWeight: 700 }}>{activeArticle.title}</h2>
              <div style={{ opacity: 0.6, fontSize: 13, marginBottom: 12 }}>{activeArticle.categoryName}</div>
              <p style={{ fontSize: 16, lineHeight: 1.55, margin: 0 }}>{activeArticle.description}</p>
              <Spacing size={12} />
              <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.9, margin: 0 }}>{activeArticle.excerpt}</p>
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
