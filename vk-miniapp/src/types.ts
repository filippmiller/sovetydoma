export interface Article {
  slug: string
  title: string
  category: string
  categoryName: string
  description: string
  image: string
  date: string
  tags: string[]
  author: string
  body: string
  url: string
}

export interface Category {
  slug: string
  name: string
  description: string
  count: number
}

export interface ContentData {
  categories: Category[]
  articles: Article[]
  generatedAt: string
}
