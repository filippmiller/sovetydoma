# Drop folder for AI-written articles

1. Generate an article with Kimi using the prompt (see docs/kimi-articles.md).
2. Save the output here as `anything.mdx` (filename doesn't matter — the real
   filename is taken from the `slug` in the frontmatter).
3. Import:  `node scripts/import-articles.mjs`            (or `--dry` to test)
4. Valid files are copied into `src/content/articles/<slug>.mdx`.
   Review with `git diff`, then commit & push — the build indexes them.

Files here (except this README) are gitignored; the real article lives in
src/content/articles after import.
