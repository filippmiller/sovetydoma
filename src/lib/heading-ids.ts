import type { ReactNode } from 'react'

export interface ArticleHeadingLink {
  id: string
  text: string
}

export function slugifyHeadingText(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function textFromReactNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textFromReactNode).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    const props = node.props as { children?: ReactNode }
    return textFromReactNode(props.children)
  }
  return ''
}

export function headingIdFromReactNode(node: ReactNode): string {
  return slugifyHeadingText(textFromReactNode(node))
}

export function extractArticleHeadings(content: string, levels = [2]): ArticleHeadingLink[] {
  const levelSet = new Set(levels)
  const headings: ArticleHeadingLink[] = []

  for (const line of content.split('\n')) {
    const match = line.match(/^(#{2,3})\s+(.+)/)
    if (!match) continue

    const level = match[1].length
    if (!levelSet.has(level)) continue

    const text = match[2].trim()
    const id = slugifyHeadingText(text)
    if (id) headings.push({ id, text })
  }

  return headings
}
