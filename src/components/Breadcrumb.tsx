import Link from 'next/link'

export interface BreadcrumbItem {
  name: string
  href?: string
}

interface Props {
  items: BreadcrumbItem[]
}

export default function Breadcrumb({ items }: Props) {
  return (
    <nav aria-label="Путь к странице" style={{ marginBottom: '1.25rem' }}>
      <ol style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.3rem',
        listStyle: 'none',
        padding: 0,
        margin: 0,
        fontSize: '0.85rem',
        color: '#888',
      }}>
        <li>
          <Link href="/" style={{ color: '#888', textDecoration: 'none' }}>Главная</Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ color: '#ccc' }}>›</span>
              {item.href ? (
                <Link href={item.href} style={{ color: '#888', textDecoration: 'none' }}>
                  {item.name}
                </Link>
              ) : (
                <span style={{ color: '#444' }} aria-current={isLast ? 'page' : undefined}>{item.name}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
