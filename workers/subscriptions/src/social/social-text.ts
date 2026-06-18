// social-text.ts — worker-safe port of scripts/lib/social-text.mjs.
//
// Renders an article's Markdown body into clean plain text for social walls
// (VK / Facebook), which have NO rich text. The best we can do is a readable
// structure using blank lines, emoji section markers and bullet characters.
//
// This is a deliberate duplicate of the Node build-time helper
// (scripts/lib/social-text.mjs) because that file lives in the `scripts/` tree
// as ESM `.mjs` and importing it into the worker would break worker isolation
// (tsconfig/types/esbuild bundle). Both files MUST stay behaviour-identical for
// the shared strip logic — keep scripts/__tests__/social-text.test.mjs and
// social-text.test.ts in sync. This port adds two worker-only concerns the
// build-time path doesn't need: optional length budgeting (`maxChars`) and a
// defensive YAML-frontmatter strip (content_matrix.body_md may carry it; the
// MDX path already strips frontmatter via gray-matter before calling render).
//
// Goals (vs. a naive strip that leaves raw "## " in posts):
//   - Headings become a spaced, emoji-prefixed line (not literal hashes).
//   - Bullet lists get a real "• " marker; numbered lists keep "1. ".
//   - Exactly one blank line between paragraphs and around headings/lists.
//   - MDX/JSX, links, code and emphasis markers are stripped to text.

export type RenderSocialTextOptions = {
  headingMarker?: string // shown before each heading
  bullet?: string // marker for unordered list items
  maxChars?: number // soft cap on the rendered output (code points); off when unset
}

const DEFAULTS: Required<Pick<RenderSocialTextOptions, 'headingMarker' | 'bullet'>> = {
  headingMarker: '🔹',
  bullet: '•',
}

function stripInline(text: string): string {
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

// Truncate to a code-point budget, preferring a sentence boundary, else a word
// boundary, then append an ellipsis. Used only for dynamic (content_matrix)
// bodies so a long article never trips buildVk/FbArticlePost's message_too_long.
function truncateToBudget(text: string, maxChars: number): string {
  const chars = [...text]
  if (chars.length <= maxChars) return text
  // reserve one code point for the ellipsis
  const budget = Math.max(0, maxChars - 1)
  let slice = chars.slice(0, budget).join('')

  // Prefer ending on a sentence terminator, but only if it keeps most of the
  // budget — otherwise an early period would chop the text far too short.
  const sentenceMatch = slice.match(/[\s\S]*[.!?…](?=\s|$)/)
  if (sentenceMatch && [...sentenceMatch[0]].length >= budget * 0.6) {
    slice = sentenceMatch[0]
  } else {
    // back off to the last whitespace so we don't cut mid-word
    const lastWs = slice.search(/\s\S*$/)
    if (lastWs > 0) slice = slice.slice(0, lastWs)
  }

  return `${slice.replace(/\s+$/, '')}…`
}

export function renderSocialText(markdown: string, options: RenderSocialTextOptions = {}): string {
  const opts = { ...DEFAULTS, ...options }
  let text = String(markdown || '')

  // Defensive: drop a leading YAML frontmatter block (content_matrix.body_md
  // may include one; MDX bodies are already frontmatter-free here).
  text = text.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')

  // Drop MDX import lines and JSX components/tags.
  text = text.replace(/^import\s+.+?\s+from\s+['"].+?['"];?\s*$/gim, '')
  text = text.replace(/<([A-Z][A-Za-z0-9]*)[^>]*>[\s\S]*?<\/\1>/g, '')
  text = text.replace(/<[a-z][^>]*\/>/g, '')
  text = text.replace(/<[^>]+>/g, '')
  // Horizontal rules -> gone
  text = text.replace(/^\s*([-=*_]){3,}\s*$/gm, '')

  const lines = text.split(/\r?\n/)
  type Block =
    | { type: 'p'; text: string }
    | { type: 'heading'; text: string }
    | { type: 'ul'; items: string[] }
    | { type: 'ol'; items: string[] }
  const blocks: Block[] = []
  let para: string[] = []
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
  const out: string[] = []
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
  const rendered = out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()

  if (opts.maxChars && opts.maxChars > 0) {
    return truncateToBudget(rendered, opts.maxChars)
  }
  return rendered
}
