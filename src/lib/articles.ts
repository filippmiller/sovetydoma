import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const articlesDirectory = path.join(process.cwd(), 'src/content/articles')

export interface ArticleFrontmatter {
  title: string
  slug: string
  category: string
  categoryName: string
  description: string
  date: string
  image: string
  tags: string[]
}

export interface Article {
  frontmatter: ArticleFrontmatter
  content: string
}

export const CATEGORIES: Record<string, { name: string; slug: string; description: string }> = {
  kulinaria: {
    name: 'Кулинария',
    slug: 'kulinaria',
    description: 'Рецепты, советы и секреты вкусной домашней кухни',
  },
  'dom-i-uborka': {
    name: 'Дом и уборка',
    slug: 'dom-i-uborka',
    description: 'Лайфхаки для чистоты и порядка в доме',
  },
  'dacha-i-ogorod': {
    name: 'Дача и огород',
    slug: 'dacha-i-ogorod',
    description: 'Советы для сада, огорода и загородной жизни',
  },
  layfkhaki: {
    name: 'Лайфхаки',
    slug: 'layfkhaki',
    description: 'Полезные идеи и хитрости на каждый день',
  },
  ekonomiya: {
    name: 'Экономия',
    slug: 'ekonomiya',
    description: 'Как жить хорошо и тратить меньше',
  },
}

export function getAllArticles(): ArticleFrontmatter[] {
  const fileNames = fs.readdirSync(articlesDirectory)
  const articles = fileNames
    .filter((f) => f.endsWith('.mdx'))
    .map((fileName) => {
      const fullPath = path.join(articlesDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const { data } = matter(fileContents)
      return data as ArticleFrontmatter
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  return articles
}

export function getArticlesByCategory(category: string): ArticleFrontmatter[] {
  return getAllArticles().filter((a) => a.category === category)
}

export function getArticle(category: string, slug: string): Article | null {
  const fileNames = fs.readdirSync(articlesDirectory)
  for (const fileName of fileNames) {
    if (!fileName.endsWith('.mdx')) continue
    const fullPath = path.join(articlesDirectory, fileName)
    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const { data, content } = matter(fileContents)
    const fm = data as ArticleFrontmatter
    if (fm.slug === slug && fm.category === category) {
      return { frontmatter: fm, content }
    }
  }
  return null
}

export function getAllSlugs(): { category: string; slug: string }[] {
  const fileNames = fs.readdirSync(articlesDirectory)
  return fileNames
    .filter((f) => f.endsWith('.mdx'))
    .map((fileName) => {
      const fullPath = path.join(articlesDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      const { data } = matter(fileContents)
      const fm = data as ArticleFrontmatter
      return { category: fm.category, slug: fm.slug }
    })
}
