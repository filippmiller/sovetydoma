# Knowledge Core export seam

SovetyDoma stays a **separate Russian site** for now. This document describes the
**future** import path into HowBase Knowledge Core. Nothing here migrates data —
it only defines a stable, normalized export format so a later import is mechanical.

## Run

```bash
node scripts/export-knowledge-articles.mjs
# → writes knowledge-export.json at repo root
```

The script reads `src/content/articles/*.mdx`, parses frontmatter + body, and
emits an array of `KnowledgeArticleExport`. It is read-only and safe to run any
time; it does not touch the live site, database, or routes.

## Format

```ts
type ArticleBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list_item'; text: string }

type KnowledgeArticleExport = {
  sourceSite: 'sovetydoma'
  sourceUrl: string            // canonical public URL
  language: 'ru'
  title: string
  slug: string
  summary: string              // quickAnswer ?? description
  category: string
  tags: string[]
  bodyBlocks: ArticleBlock[]
  publishedAt: string          // ISO date
  updatedAt: string            // ISO date (falls back to publishedAt)
  authorPersona?: string       // persona slug (see src/lib/personas.ts)
  seo: { title: string; description: string }
}
```

## Field mapping (SovetyDoma → Knowledge Core)

| Knowledge Core | SovetyDoma source |
|---|---|
| `sourceUrl` | `${SITE_URL}/${category}/${slug}/` |
| `summary` | `quickAnswer` ?? `description` |
| `bodyBlocks` | MDX body split into heading/paragraph/list blocks |
| `authorPersona` | frontmatter `author` ?? category→persona default |
| `seo.description` | frontmatter `description` |

## Notes for the future import

- Slugs are unique per site; namespace them on import (`sovetydoma:<slug>`).
- `language: 'ru'` — Knowledge Core should keep language as a first-class field;
  do not auto-translate on import.
- Editorial profiles live in `src/lib/personas.ts`, each
  with a disclosure string. Preserve that disclosure on import — never present
  them as real humans.
- Recipe/HowTo/FAQ structured data lives in frontmatter
  (`schemaType`, `recipeIngredient`, `recipeSteps`, etc.) and can be mapped to
  Knowledge Core structured blocks in a later iteration if needed.

## Do NOT (yet)

- Do not migrate SovetyDoma into HowBase core.
- Do not change SovetyDoma routes/slugs to match HowBase.
- Do not remove the Russian UI.

This seam exists so that *when* extraction is requested, it is a single script
run plus an importer on the HowBase side.
