import type { ReactNode } from 'react'
import { headingIdFromReactNode } from '@/lib/heading-ids'

interface Props {
  children: ReactNode
}

export function ArticleH2({ children }: Props) {
  const id = headingIdFromReactNode(children)
  return id ? <h2 id={id}>{children}</h2> : <h2>{children}</h2>
}

export function ArticleH3({ children }: Props) {
  const id = headingIdFromReactNode(children)
  return id ? <h3 id={id}>{children}</h3> : <h3>{children}</h3>
}
