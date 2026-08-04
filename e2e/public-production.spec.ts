import { expect, test, type Page } from '@playwright/test'

const categories = [
  'dacha-i-ogorod', 'dom-i-uborka', 'ekonomiya', 'krasota-i-uhod',
  'kulinaria', 'layfkhaki', 'otdyh-i-puteshestviya', 'pokupki-i-tehnika',
  'rybalka', 'semya-i-deti', 'zdorovie-i-bezopasnost', 'avto',
]

const healthArticles = [
  'rastitelny-belok-chem-zamenit-myaso',
  'supy-dlya-zdorovya-semi',
  'travyanye-chai-doma-prigotovlenie',
  'zagotovki-bez-sahara-sohranyaem-vitaminy',
  'zdorovye-zavtrki-na-kazhdyy-den',
]

const utilityRoutes = [
  '/', '/articles/', '/search/', '/recepty/', '/tag/', '/podpiski/', '/izbrannoe/', '/moy-kabinet/',
]

async function goto(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response, `${path} returned a navigation response`).not.toBeNull()
  expect(response!.status(), path).toBe(200)
  await expect(page.locator('html')).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'document must not horizontally overflow its viewport').toBeLessThanOrEqual(1)
}

function failuresFor(page: Page) {
  const pageErrors: string[] = []
  const failedSameOrigin: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const url = new URL(request.url())
    if (url.origin === new URL(page.url() || 'https://1001sovet.ru').origin && request.method() === 'GET') {
      failedSameOrigin.push(`${request.method()} ${url.pathname}: ${request.failure()?.errorText || 'failed'}`)
    }
  })
  return { pageErrors, failedSameOrigin }
}

test.describe('public production journeys (read-only)', () => {
  test('release identity, crawler entry points and sitemap inventory are live', async ({ request }) => {
    const [build, robots, sitemap, rss] = await Promise.all([
      request.get('/build.json'), request.get('/robots.txt'), request.get('/sitemap.xml'), request.get('/feed.xml'),
    ])
    expect(build.ok()).toBeTruthy()
    const release = await build.json()
    expect(release.sha).toMatch(/^[a-f0-9]{40}$/i)
    expect(release.ref).toMatch(/^(master|main)$/)
    expect(await robots.text()).toMatch(/sitemap/i)
    const xml = await sitemap.text()
    expect(xml).toContain('<urlset')
    expect((xml.match(/<loc>/g) || []).length, 'static sitemap URL count').toBeGreaterThanOrEqual(548)
    expect((await rss.text())).toContain('<rss')
  })

  test('utility routes load with title, description, canonical and no desktop rail', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop-only rail assertion')
    for (const path of utilityRoutes) {
      await goto(page, path)
      await expect(page).toHaveTitle(/\S+/)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S+/)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${path === '/' ? '' : path.replace(/\/$/, '')}/?$`))
      await expect(page.locator('.article-page-rail')).toHaveCount(0)
    }
  })

  test('homepage contains its complete editorial entry points without a narrow content rail', async ({ page }, testInfo) => {
    test.fixme(true, 'sovetydoma-300: required homepage entry blocks are absent in production')
    test.skip(testInfo.project.name !== 'desktop', 'desktop content-width assertion')
    await goto(page, '/')
    await expect(page.getByRole('heading', { name: 'По разделам' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Популярн/i })).toBeVisible()
    await expect(page.getByText(/С чего начать/i)).toBeVisible()
    await expect.poll(() => page.locator('img[src^="/images/categories/"]').count()).toBeGreaterThanOrEqual(12)
    const mainWidth = await page.locator('main').evaluate((el) => el.getBoundingClientRect().width)
    expect(mainWidth, 'homepage main content must not regress to a 780px article column').toBeGreaterThan(900)
  })

  test('all twelve category pages expose article navigation and semantic metadata', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sidebar assertions')
    for (const category of categories) {
      await goto(page, `/${category}/`)
      await expect(page.locator('.article-page-rail')).toBeVisible()
      await expect(page.locator('.feed-left-nav')).toBeVisible()
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${category}/?$`))
      await expect(page.locator('h1')).toBeVisible()
      await expect.poll(() => page.locator(`a[href^="/${category}/"]`).count()).toBeGreaterThan(1)
    }
  })

  test('sidebar subcategory navigation applies a same-page hash filter and scrolls to results', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sidebar journey')
    await goto(page, '/kulinaria/')
    const nav = page.locator('.feed-left-nav')
    await nav.getByRole('button', { name: /Кулинария/ }).click()
    const subcategory = nav.locator('a[href="#supy"]')
    await expect(subcategory).toBeVisible()
    await subcategory.click()
    await expect(page).toHaveURL(/\/kulinaria\/#supy$/)
    await expect(page.locator('#category-browser-results')).toBeVisible()
    await expect.poll(() => page.locator('#category-browser-results').evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(420)
  })

  test('each health article has a real cover, JSON-LD, TOC, progress and non-empty related content', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'article semantic coverage runs once')
    for (const slug of healthArticles) {
      await goto(page, `/kulinaria/${slug}/`)
      await expect(page.locator('.article-page-rail')).toBeVisible()
      await expect(page.locator('[role="progressbar"]')).toHaveAttribute('aria-label', 'Прогресс чтения')
      await expect(page.locator('nav[aria-label="Содержание статьи"] a').first()).toBeVisible()
      await expect.poll(() => page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(1)
      const cover = page.locator('article img').first()
      await expect(cover).toBeVisible()
      await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBeTruthy()
      await expect(page.locator('a[href^="/kulinaria/"]').filter({ hasText: /./ }).nth(2)).toBeVisible()
    }
  })

  test('article client islands load without a runtime exception and anonymous favorite remains local', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once in an anonymous context')
    const observed = failuresFor(page)
    await goto(page, '/kulinaria/rastitelny-belok-chem-zamenit-myaso/')
    await expect(page.locator('[data-dynamic-widget="favorite"] button')).toBeVisible()
    await expect(page.locator('[data-dynamic-widget="reactions"] button')).toHaveCount(4)
    await expect(page.getByRole('button', { name: 'Оценить на 5 из 5' })).toBeVisible()
    await expect(page.locator('[data-dynamic-widget="questions"]')).toBeVisible()
    await page.locator('[data-dynamic-widget="favorite"] button').click()
    await expect.poll(() => page.evaluate(() => localStorage.getItem('favorites'))).toContain('rastitelny-belok-chem-zamenit-myaso')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /Закрыть|Отмена/i }).first().click()
    expect(observed.pageErrors).toEqual([])
    expect(observed.failedSameOrigin).toEqual([])
  })

  test('search autocomplete and keyboard navigation expose actual article suggestions', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop header autocomplete journey')
    await goto(page, '/')
    const input = page.getByRole('combobox', { name: 'Поиск по статьям' })
    await input.fill('белок')
    await expect(page.getByRole('listbox')).toBeVisible()
    await expect.poll(() => page.getByRole('option').count()).toBeGreaterThan(0)
    await input.press('ArrowDown')
    await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')
  })

  test('mobile header menu is focusable, closes with Escape and pages do not overflow horizontally', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile-only journey')
    await goto(page, '/')
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Открыть меню' }).click()
    const dialog = page.getByRole('dialog', { name: 'Меню навигации' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: 'Закрыть меню' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await goto(page, '/kulinaria/rastitelny-belok-chem-zamenit-myaso/')
    await expect(page.locator('.article-page-rail')).toBeVisible()
    const overflow = await page.locator('.article-page-rail').evaluate((el) => getComputedStyle(el).overflowX)
    expect(['auto', 'scroll']).toContain(overflow)
    await expectNoHorizontalOverflow(page)
    for (const selector of ['.hamburger-btn', '[data-dynamic-widget="favorite"] button', 'button[aria-label="Оценить на 5 из 5"]']) {
      const box = await page.locator(selector).boundingBox()
      expect(box, `${selector} must be rendered`).not.toBeNull()
      expect(Math.min(box!.width, box!.height), `${selector} touch target`).toBeGreaterThanOrEqual(40)
    }
  })
})

test.describe('stateful production flows require explicit QA authority', () => {
  test.skip(process.env.E2E_ALLOW_ACTIVE !== '1', 'BLOCKED: set E2E_ALLOW_ACTIVE=1 only with dedicated owned QA accounts, provider sandboxes and cleanup proof')

  test('email/OAuth, UGC, push and subscription lifecycles are intentionally not run against anonymous production', async () => {
    // This guard is an audit control: implementation belongs in a dedicated QA
    // environment after credentials, provider ownership and cleanup contracts exist.
  })
})
