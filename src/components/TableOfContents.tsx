import { extractArticleHeadings } from '@/lib/heading-ids'

interface Props {
  content: string
  sidebar?: boolean
}

export default function TableOfContents({ content, sidebar = false }: Props) {
  const headings = extractArticleHeadings(content)
  if (headings.length < 2) return null

  return (
    <nav
      className={`toc${sidebar ? ' toc-sidebar' : ''}`}
      aria-label="Содержание статьи"
      style={sidebar ? {
        position: 'sticky',
        top: '80px',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
      } : undefined}
    >
      <div className="toc-title">Содержание</div>
      {headings.map((h) => (
        <a key={h.id} href={`#${h.id}`}>
          {h.text}
        </a>
      ))}
    </nav>
  )
}
