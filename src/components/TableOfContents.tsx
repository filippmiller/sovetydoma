interface Props {
  content: string
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

export default function TableOfContents({ content }: Props) {
  const headings = extractHeadings(content)
  if (headings.length < 2) return null

  return (
    <nav className="toc" aria-label="Содержание статьи">
      <div className="toc-title">Содержание</div>
      {headings.map((h) => (
        <a key={h.id} href={`#${h.id}`}>
          {h.text}
        </a>
      ))}
    </nav>
  )
}
