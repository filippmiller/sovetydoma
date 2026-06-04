# Writing articles with Kimi (or any AI) → publishing to СоветыДома

The site renders MDX files in `src/content/articles/`. Each needs exact
frontmatter. Use the prompt below with Kimi, then bulk-import.

## 1. The Kimi prompt

````
Ты — редактор русского сайта бытовых советов «СоветыДома». Напиши ОДНУ статью
строго в формате MDX-файла. Выведи ТОЛЬКО содержимое файла, без пояснений и
без обёртки ```.

ТЕМА: <ВПИШИ ТЕМУ>

ФРОНТМАТТЕР между --- и ---:
  title: "..."          (40–70 символов)
  slug: "..."           (ТОЛЬКО латиница, цифры, дефисы — транслитерация темы)
  category: "..."       (одно из: kulinaria, dom-i-uborka, dacha-i-ogorod, layfkhaki, ekonomiya)
  categoryName: "..."   (kulinaria→Кулинария, dom-i-uborka→Дом и уборка,
                         dacha-i-ogorod→Дача и огород, layfkhaki→Лайфхаки, ekonomiya→Экономия)
  description: "..."    (1 предложение, до 160 символов)
  date: "ГГГГ-ММ-ДД"    (сегодня)
  image: "/images/<slug>.jpg"   (exactly this; the matching /public/images/<slug>.jpg is committed before deploy)
  tags: ["...","...","..."]   (3–6 тегов по-русски)

Для рецептов (kulinaria) добавь: schemaType: "Recipe", prepTime, cookTime
(ISO 8601, напр. PT30M), recipeYield, recipeIngredient (список), difficulty
(Легко|Средне|Сложно).

ТЕЛО (после второго ---): короткое вступление без заголовка, затем 4–8
разделов с "## Заголовок", 700–1200 слов, практично, списки и **жирный**
разрешены. Без английских слов (кроме slug), без упоминания ИИ.
````

## 2. Import

```bash
# drop Kimi's .mdx files into ./incoming-articles, then:
node scripts/import-articles.mjs --dry      # validate only
node scripts/import-articles.mjs            # validate + copy to src/content/articles
git diff                                    # review
git add src/content/articles && git commit -m "content: new articles" && git push
```

Validation rejects: missing fields, bad category, mismatched categoryName,
Cyrillic/duplicate slug, empty tags, bad date, recipes without ingredients,
and bodies under 200 words. Nothing invalid reaches the build.

## 3. Notes
- Images: always output exactly `image: "/images/<slug>.jpg"`. Real photos (or
  generated fallbacks) under public/images/<slug>.jpg are committed to git and
  served; the build now hard-enforces the fm match and file presence.
- New articles appear on the site automatically after deploy (build re-indexes).
- Single article check: `node scripts/validate-article.mjs src/content/articles/<slug>.mdx`
