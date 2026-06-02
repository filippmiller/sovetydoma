import Link from 'next/link'
import type { CSSProperties } from 'react'

type Props = {
  categorySlug: string
  categoryName: string
  placement: 'article-header' | 'article-footer' | 'category-header' | 'footer'
}

const PLACEHOLDERS: Record<Props['placement'], CSSProperties> = {
  'article-header': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.42rem 0.72rem',
    borderRadius: 999,
    border: '1px solid #c0392b',
    background: '#fff4f2',
    color: '#c0392b',
    fontSize: '0.78rem',
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  'article-footer': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '0.8rem 1rem',
    borderRadius: 8,
    border: '1px solid #c0392b',
    background: '#c0392b',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  'category-header': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.45rem 0.78rem',
    borderRadius: 999,
    border: '1px solid #c0392b',
    background: '#fff',
    color: '#c0392b',
    fontSize: '0.8rem',
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  footer: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.42rem 0.72rem',
    borderRadius: 999,
    border: '1px solid #e67e22',
    background: '#fff8ef',
    color: '#b65f00',
    fontSize: '0.78rem',
    fontWeight: 700,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
}

export default function CategorySubscriptionCta({ categorySlug, categoryName, placement }: Props) {
  return (
    <Link
      href={`/podpiski/?category=${encodeURIComponent(categorySlug)}#subscription-panel`}
      aria-label={`Подписаться на категорию ${categoryName}`}
      style={PLACEHOLDERS[placement]}
    >
      Подписаться на эту категорию
    </Link>
  )
}
