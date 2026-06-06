import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { CATEGORIES } from '../../src/lib/categories.mjs'

const root = path.join(import.meta.dirname, '..', '..')

describe('category generators', () => {
  it('keeps sitemap category hubs in sync with shared categories', () => {
    const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8')

    for (const category of Object.values(CATEGORIES)) {
      assert.match(sitemap, new RegExp(`<loc>https://1001sovet\\.ru/${category.slug}/</loc>`))
    }
  })

  it('keeps per-category RSS feeds in sync with shared categories', () => {
    for (const category of Object.values(CATEGORIES)) {
      assert.equal(
        fs.existsSync(path.join(root, 'public', `feed-${category.slug}.xml`)),
        true,
        `missing feed-${category.slug}.xml`,
      )
    }
  })

  it('includes new static SEO pages in sitemap (advert, articles, archive, legal, cookies)', () => {
    const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8')
    const required = ['/advert/', '/articles/', '/archive/', '/terms/', '/privacy/', '/cookies/']
    for (const p of required) {
      assert.match(sitemap, new RegExp(`<loc>https://1001sovet\\.ru${p.replace(/\//g, '\\/')}<\\/loc>`), `missing ${p} in sitemap`)
    }
  })

  it('includes generated article pagination pages in sitemap', () => {
    const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8')
    const articleDir = path.join(root, 'src', 'content', 'articles')
    const articleCount = fs.readdirSync(articleDir).filter((file) => file.endsWith('.mdx')).length
    const totalPages = Math.max(1, Math.ceil(articleCount / 24))

    for (let page = 2; page <= totalPages; page++) {
      assert.match(
        sitemap,
        new RegExp(`<loc>https://1001sovet\\.ru\\/articles\\/page\\/${page}\\/<\\/loc>`),
        `missing /articles/page/${page}/ in sitemap`,
      )
    }
  })

  it('robots.txt allows * and does not blanket-disallow root', () => {
    const robots = fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8')
    assert.match(robots, /User-agent:\s*\*/)
    assert.match(robots, /Allow:\s*\//)
    // Must not have the old blanket "Disallow: /" for *
    const lines = robots.split(/\r?\n/)
    let sawStar = false
    for (const line of lines) {
      if (/^\s*User-agent:\s*\*/i.test(line)) { sawStar = true; continue }
      if (sawStar && /^\s*Disallow:\s*\/\s*$/i.test(line)) {
        assert.fail('robots.txt still has blanket "Disallow: /" after User-agent: *')
      }
      if (/^User-agent:/i.test(line)) sawStar = false
    }
    // sanity: sitemap line present
    assert.match(robots, /Sitemap:\s*https:\/\/1001sovet\.ru\/sitemap\.xml/i)
  })

  it('canonical share URLs follow https://1001sovet.ru/{cat}/{slug}/ pattern (used by card share)', () => {
    // We use explicit construction in CardShareButton + articleCanonicalUrl in article pages
    const examples = [
      'https://1001sovet.ru/zdorovie-i-bezopasnost/bezopasnost-doma-dlya-rebenka/',
      'https://1001sovet.ru/semya-i-deti/spisok-pokupok-dlya-semi/',
      'https://1001sovet.ru/pokupki-i-tehnika/telefon-v-zharkuyu-pogodu/',
    ]
    for (const u of examples) {
      assert.match(u, /^https:\/\/1001sovet\.ru\/[a-z0-9-]+\/[a-z0-9-]+\/$/)
    }
  })

  it('sitemap contains image:image entries for articles', () => {
    const sitemap = fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8')
    assert.match(sitemap, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/)
    // Verify at least one article has an image block
    assert.match(sitemap, /<image:image>/)
    assert.match(sitemap, /<image:loc>https:\/\/1001sovet\.ru\/images\/[a-z0-9-]+\.jpg<\/image:loc>/)
    assert.match(sitemap, /<image:title>/)
  })

  it('layout.tsx generates RSS alternate links for all CATEGORIES', () => {
    const layout = fs.readFileSync(path.join(root, 'src', 'app', 'layout.tsx'), 'utf8')
    // Must use CATEGORIES map instead of hardcoded links
    assert.match(layout, /Object\.values\(CATEGORIES\)/)
    // Must contain the template pattern for per-category feeds
    assert.match(layout, /feed-\$\{cat\.slug\}\.xml/)
    // Should not contain the old hardcoded category feed links
    assert.ok(!layout.includes('feed-kulinaria.xml'), 'layout.tsx still hardcodes feed-kulinaria.xml')
    assert.ok(!layout.includes('feed-dom-i-uborka.xml'), 'layout.tsx still hardcodes feed-dom-i-uborka.xml')
    assert.ok(!layout.includes('feed-dacha-i-ogorod.xml'), 'layout.tsx still hardcodes feed-dacha-i-ogorod.xml')
    assert.ok(!layout.includes('feed-layfkhaki.xml'), 'layout.tsx still hardcodes feed-layfkhaki.xml')
    assert.ok(!layout.includes('feed-ekonomiya.xml'), 'layout.tsx still hardcodes feed-ekonomiya.xml')
  })

  it('homepage does not pass full getAllArticles() directly to ArticleCatalogGrid', () => {
    const page = fs.readFileSync(path.join(root, 'src', 'app', 'page.tsx'), 'utf8')
    // Must slice/limit articles before passing to the grid
    assert.match(page, /HOMEPAGE_ARTICLE_LIMIT/)
    assert.match(page, /\.slice\(/)
    // Should not pass the unfiltered getAllArticles() result to ArticleCatalogGrid
    const gridPass = page.match(/ArticleCatalogGrid\s+articles=\{([^}]+)\}/)
    assert.ok(gridPass, 'could not find ArticleCatalogGrid articles prop')
    assert.ok(!gridPass[1].includes('getAllArticles()'), 'homepage passes raw getAllArticles() to ArticleCatalogGrid')
  })
})
