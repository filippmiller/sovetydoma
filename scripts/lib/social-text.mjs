// social-text.mjs — render an article's Markdown body into clean plain text for
// social walls (VK / Facebook). These platforms have NO rich text: no bold, no
// fonts, no real headings. The best we can do is a readable structure using
// blank lines, emoji section markers and bullet characters.
//
// Goals (vs. the old stripMarkdownAndMdx which left raw "## " in posts):
//   - Headings become a spaced, emoji-prefixed line (not literal hashes).
//   - Bullet lists get a real "• " marker; numbered lists keep "1. ".
//   - Exactly one blank line between paragraphs and around headings/lists.
//   - MDX/JSX, links, code and emphasis markers are stripped to text.

const DEFAULTS = {
  headingMarker: '🔹', // shown before each ## heading
  bullet: '•',
}

function stripInline(text) {
  return text
    // markdown links / images -> visible text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    // bold / italic markers -> plain
    .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, '$2')
    // inline code
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    // stray leftover emphasis chars at token edges
    .replace(/\s\*+\s/g, ' ')
    .trim()
}

export function renderSocialText(markdown, options = {}) {
  const opts = { ...DEFAULTS, ...options }
  let text = String(markdown || '')

  // Drop MDX import lines and JSX components/tags.
  text = text.replace(/^import\s+.+?\s+from\s+['"].+?['"];?\s*$/gim, '')
  text = text.replace(/<([A-Z][A-Za-z0-9]*)[^>]*>[\s\S]*?<\/\1>/g, '')
  text = text.replace(/<[a-z][^>]*\/>/g, '')
  text = text.replace(/<[^>]+>/g, '')
  // Horizontal rules -> gone
  text = text.replace(/^\s*([-=*_]){3,}\s*$/gm, '')

  const lines = text.split(/\r?\n/)
  const blocks = [] // each block is { type: 'p'|'heading'|'ul'|'ol', ... }
  let para = []
  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: stripInline(para.join(' ').replace(/\s+/g, ' ').trim()) })
      para = []
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) { flushPara(); continue }

    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) {
      flushPara()
      blocks.push({ type: 'heading', text: stripInline(heading[1]) })
      continue
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/)
    if (bullet) {
      flushPara()
      const last = blocks[blocks.length - 1]
      const item = stripInline(bullet[1])
      if (last && last.type === 'ul') last.items.push(item)
      else blocks.push({ type: 'ul', items: [item] })
      continue
    }

    const ordered = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (ordered) {
      flushPara()
      const last = blocks[blocks.length - 1]
      const item = stripInline(ordered[2])
      if (last && last.type === 'ol') last.items.push(item)
      else blocks.push({ type: 'ol', items: [item] })
      continue
    }

    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      flushPara()
      blocks.push({ type: 'p', text: stripInline(quote[1]) })
      continue
    }

    para.push(line)
  }
  flushPara()

  // Render blocks with consistent spacing.
  const out = []
  for (const block of blocks) {
    if (block.type === 'heading') {
      out.push(`${opts.headingMarker} ${block.text}`)
    } else if (block.type === 'p') {
      if (block.text) out.push(block.text)
    } else if (block.type === 'ul') {
      out.push(block.items.map((i) => `${opts.bullet} ${i}`).join('\n'))
    } else if (block.type === 'ol') {
      out.push(block.items.map((i, idx) => `${idx + 1}. ${i}`).join('\n'))
    }
  }

  // One blank line between blocks; collapse any accidental runs.
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

const socialText = { renderSocialText }
export default socialText
