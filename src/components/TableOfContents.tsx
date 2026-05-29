interface Props {
  content: string
  sidebar?: boolean
}

interface Heading {
  id: string
  text: string
}

function extractHeadings(content: string): Heading[] {
  const lines = content.split('\n')
  const headings: Heading[] = []
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/)
    if (match) {
      const text = match[1].trim()
      const id = text
        .toLowerCase()
        .replace(/[^a-zа-яё0-9\s]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
      headings.push({ id, text })
    }
  }
  return headings
}

export default function TableOfContents({ content, sidebar = false }: Props) {
  const headings = extractHeadings(content)
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
