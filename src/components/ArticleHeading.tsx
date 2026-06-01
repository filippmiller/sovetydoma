import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

function textFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    const props = node.props as { children?: ReactNode }
    return textFromNode(props.children)
  }
  return ''
}

function headingId(children: ReactNode): string {
  return textFromNode(children)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function ArticleH2({ children }: Props) {
  const id = headingId(children)
  return <h2 id={id}>{children}</h2>
}

export function ArticleH3({ children }: Props) {
  const id = headingId(children)
  return <h3 id={id}>{children}</h3>
}
