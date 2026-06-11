// NO-REDEPLOY publishing: this worker makes article publishing rebuild-free.
// See docs/NO-REDEPLOY-PUBLISHING.md

/**
 * Minimal dependency-free Markdown → HTML renderer.
 * Handles the subset used in SovetyDoma articles:
 *   - ## and ### headings (with slugified id attributes, same logic as ArticleH2/H3)
 *   - paragraphs, **bold**, *italic*, `inline code`
 *   - unordered lists (- / *)
 *   - ordered lists (1.)
 *   - blockquotes (>)
 *   - fenced code blocks (```)
 *   - links [text](url)
 *   - GitHub-style tables
 *   - MDX-specific components stripped to safe HTML:
 *       <ArticleChecklist ...>...</ArticleChecklist>  → renders inner markdown
 *       <AffiliateLink href="..." ...>text</AffiliateLink> → <a href>text</a>
 *       Any other unknown JSX tags → inner text only
 *
 * Output class names mirror what the static build emits inside <article class="prose">.
 * h2/h3 get no class (bare tags with id), matching ArticleH2/ArticleH3 output.
 * p, ul, ol, li, table, th, td, a, blockquote, code — no extra classes; styled by
 * the site's global CSS targeting .prose descendants.
 */

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Strip MDX JSX component tags, rendering inner content safely. */
function stripMdxComponents(src: string): string {
  // <AffiliateLink href="…" …>inner</AffiliateLink> → <a href="…">inner</a>
  src = src.replace(
    /<AffiliateLink\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/AffiliateLink>/g,
    (_m, href, inner) => `[${inner.trim()}](${href})`,
  )
  // <ArticleChecklist> … </ArticleChecklist> → render inner content as-is
  src = src.replace(/<ArticleChecklist[^>]*>([\s\S]*?)<\/ArticleChecklist>/g, (_m, inner) => inner)
  // Any remaining unknown JSX self-closing or paired tags → strip tags, keep text
  src = src.replace(/<[A-Z][A-Za-z]*(?:\s[^>]*)?\/?>/g, '')
  src = src.replace(/<\/[A-Z][A-Za-z]*>/g, '')
  return src
}

/** Apply inline markdown: bold, italic, inline code, links. Operates on already-escaped text only when called from block renderers that need escaping first. */
function inlineHtml(raw: string): string {
  // Escape HTML first, then restore our own tags
  let s = escHtml(raw)
  // Inline code (must come before bold/italic to avoid munging backtick content)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Bold **text** or __text__
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  // Italic *text* or _text_ (single)
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>')
  // Links [text](url)
  s = s.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2">$1</a>')
  return s
}

interface Block {
  type: 'heading2' | 'heading3' | 'paragraph' | 'ul' | 'ol' | 'blockquote' | 'code' | 'table' | 'blank'
  raw: string[]
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Fenced code block
    if (line.startsWith('```')) {
      const raw: string[] = [line]
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        raw.push(lines[i])
        i++
      }
      if (i < lines.length) raw.push(lines[i]) // closing ```
      i++
      blocks.push({ type: 'code', raw })
      continue
    }

    // Headings
    const h2 = line.match(/^## (.+)/)
    if (h2) {
      blocks.push({ type: 'heading2', raw: [line] })
      i++
      continue
    }
    const h3 = line.match(/^### (.+)/)
    if (h3) {
      blocks.push({ type: 'heading3', raw: [line] })
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      const raw: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        raw.push(lines[i])
        i++
      }
      blocks.push({ type: 'blockquote', raw })
      continue
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      const raw: string[] = []
      while (i < lines.length && (/^[-*] /.test(lines[i]) || lines[i].startsWith('  '))) {
        raw.push(lines[i])
        i++
      }
      blocks.push({ type: 'ul', raw })
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const raw: string[] = []
      while (i < lines.length && (/^\d+\. /.test(lines[i]) || lines[i].startsWith('  '))) {
        raw.push(lines[i])
        i++
      }
      blocks.push({ type: 'ol', raw })
      continue
    }

    // Table (line with | chars and next line is separator)
    if (line.includes('|') && i + 1 < lines.length && /^\|?[-:| ]+\|/.test(lines[i + 1])) {
      const raw: string[] = [line]
      i++
      while (i < lines.length && lines[i].includes('|')) {
        raw.push(lines[i])
        i++
      }
      blocks.push({ type: 'table', raw })
      continue
    }

    // Paragraph — collect until blank line or block-level element
    const raw: string[] = []
    while (
      i < lines.length
      && lines[i].trim() !== ''
      && !lines[i].startsWith('#')
      && !lines[i].startsWith('```')
      && !lines[i].startsWith('>')
      && !/^[-*] /.test(lines[i])
      && !/^\d+\. /.test(lines[i])
    ) {
      raw.push(lines[i])
      i++
    }
    if (raw.length) blocks.push({ type: 'paragraph', raw })
  }

  return blocks
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'heading2': {
      const text = block.raw[0].replace(/^## /, '')
      const id = slugify(text)
      return id ? `<h2 id="${escHtml(id)}">${inlineHtml(text)}</h2>\n` : `<h2>${inlineHtml(text)}</h2>\n`
    }
    case 'heading3': {
      const text = block.raw[0].replace(/^### /, '')
      const id = slugify(text)
      return id ? `<h3 id="${escHtml(id)}">${inlineHtml(text)}</h3>\n` : `<h3>${inlineHtml(text)}</h3>\n`
    }
    case 'paragraph': {
      const text = block.raw.join(' ').trim()
      return `<p>${inlineHtml(text)}</p>\n`
    }
    case 'ul': {
      const items = block.raw
        .filter((l) => /^[-*] /.test(l))
        .map((l) => `<li>${inlineHtml(l.replace(/^[-*] /, ''))}</li>`)
        .join('\n')
      return `<ul>\n${items}\n</ul>\n`
    }
    case 'ol': {
      const items = block.raw
        .filter((l) => /^\d+\. /.test(l))
        .map((l) => `<li>${inlineHtml(l.replace(/^\d+\. /, ''))}</li>`)
        .join('\n')
      return `<ol>\n${items}\n</ol>\n`
    }
    case 'blockquote': {
      const inner = block.raw.map((l) => l.replace(/^> ?/, '')).join(' ')
      return `<blockquote><p>${inlineHtml(inner)}</p></blockquote>\n`
    }
    case 'code': {
      const lang = block.raw[0].replace(/^```/, '').trim()
      const code = block.raw.slice(1, -1).join('\n')
      const langAttr = lang ? ` class="language-${escHtml(lang)}"` : ''
      return `<pre><code${langAttr}>${escHtml(code)}</code></pre>\n`
    }
    case 'table': {
      const [headerLine, , ...bodyLines] = block.raw
      const headerCells = headerLine
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => `<th>${inlineHtml(c)}</th>`)
        .join('')
      const bodyRows = bodyLines.map((row) => {
        const cells = row
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => `<td>${inlineHtml(c)}</td>`)
          .join('')
        return `<tr>${cells}</tr>`
      }).join('\n')
      return `<table>\n<thead><tr>${headerCells}</tr></thead>\n<tbody>\n${bodyRows}\n</tbody>\n</table>\n`
    }
    default:
      return ''
  }
}

export function mdToHtml(markdown: string): string {
  // Pre-process: strip MDX JSX components
  const cleaned = stripMdxComponents(markdown)
  const lines = cleaned.split('\n')
  const blocks = parseBlocks(lines)
  return blocks.map(renderBlock).join('')
}
