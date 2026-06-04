# Kimi — 500-article self-managed batch for СоветыДома

This batch is **self-managed**: Kimi invents the topics, assigns + verifies its
own slugs, validates, and commits every 50 articles (10 commits total).
Paste the whole prompt below into Kimi.

---

## PROMPT FOR KIMI

````
Ты — редактор русского сайта бытовых советов «СоветыДома». Твоя задача —
написать 500 НОВЫХ статей и опубликовать их в репозитории, работая партиями
по 50 с коммитом после каждой партии (итого 10 коммитов).

РАБОЧАЯ ПАПКА: C:\DEV\sovetydoma
ФАЙЛЫ СТАТЕЙ КЛАДЁШЬ В: src/content/articles/<slug>.mdx

== КАТЕГОРИИ (только эти 6) ==
  kulinaria       → Кулинария
  dom-i-uborka    → Дом и уборка
  dacha-i-ogorod  → Дача и огород
  layfkhaki       → Лайфхаки
  ekonomiya       → Экономия
  rybalka         → Рыбалка

Баланс распределяй сам, но с упором на дачу/огород, дом, рецепты и рыбалку.
Не менее 60 статей про рыбалку (раздел новый и почти пустой).

== ТЫ САМ ПРИДУМЫВАЕШЬ ТЕМЫ ==
Конкретные узкие практичные темы. Без общих и повторяющихся формулировок.
Примеры: «Как солить сало в рассоле», «Чем подкормить розы в июле»,
«Ловля щуки на спиннинг осенью», «Как отмыть пригоревшую эмалированную
кастрюлю».

== SLUG: НАЗНАЧАЙ И ПРОВЕРЯЙ САМ ==
Для каждой статьи:
1. slug = транслитерация темы: ТОЛЬКО латиница в нижнем регистре, цифры,
   дефисы. Без кириллицы, пробелов, подчёркиваний.
2. ПРОВЕРЬ уникальность ПЕРЕД записью файла:
   - нет файла src/content/articles/<slug>.mdx (уже существующих ~160 статей
     не трогай и не дублируй),
   - slug не повторяется среди уже созданных в этом запуске.
   Если занят — добавь уточнение: -2, -letom, -v-domashnih-usloviyah и т.п.
3. Имя файла = <slug>.mdx; поле slug во фронтматтере = тот же slug.

== ФОРМАТ КАЖДОГО ФАЙЛА (MDX) ==
Между --- и ---:
  title: "..."          (40–70 символов, по-русски)
  slug: "..."           (как выше)
  category: "..."       (один из 6 слагов категорий)
  categoryName: "..."   (СТРОГО: kulinaria→Кулинария, dom-i-uborka→Дом и уборка,
                         dacha-i-ogorod→Дача и огород, layfkhaki→Лайфхаки,
                         ekonomiya→Экономия, rybalka→Рыбалка)
  description: "..."    (1 предложение, до 160 символов)
  date: "2026-05-31"
  image: "/images/<slug>.jpg"   (exactly; matching jpg committed via fetch/generate scripts)
  tags: ["...","...","...","..."]   (4–6 тегов по-русски)

Для рецептов (category: kulinaria) ДОБАВЬ:
  schemaType: "Recipe"
  prepTime: "PT20M"     (ISO 8601)
  cookTime: "PT40M"
  recipeYield: "4 порции"
  difficulty: "Легко"   (Легко | Средне | Сложно)
  recipeIngredient:
    - "ингредиент с количеством"
    - "..."

Тело (после второго ---):
  - вступление 2–3 предложения БЕЗ заголовка
  - 5–8 разделов, каждый с "## Заголовок"
  - 700–1200 слов, конкретика: числа, сроки, пропорции, температуры
  - списки (- пункт) и **жирный** для важного
  - без английских слов (кроме slug), без шаблонного «Заключение»
  - не упоминай ИИ

== ПРОЦЕСС: 10 ПАРТИЙ × 50 СТАТЕЙ ==
Для каждой партии N от 1 до 10:
  1. Сгенерируй 50 статей, записывая файлы прямо в src/content/articles/.
     Перед каждым файлом проверь уникальность slug (см. выше).
  2. Проверь КАЖДЫЙ новый файл валидатором — ошибок быть не должно:
       node scripts/validate-article.mjs src/content/articles/<slug>.mdx
     Если есть ошибка — исправь файл и проверь снова.
  3. Закоммить и запушь партию:
       git add src/content/articles
       git commit -m "content: batch N/10 — 50 articles"
       git push
  4. Переходи к следующей партии.
ИТОГО ровно 10 коммитов, 500 новых статей.

ПРАВИЛА:
- НЕ переписывай и НЕ дублируй существующие статьи (проверяй коллизии slug).
- Если валидатор ругается — чини до коммита.
- Каждая партия = ровно 50 новых статей.
- Подтверди план и начинай с партии 1/10.
````

---

## After Kimi finishes (your quick checks)

```bash
ls src/content/articles/*.mdx | wc -l     # expect ~660 (≈160 + 500)
npm run build                             # should pass; pages scale fine
git log --oneline | head -12              # expect 10 "batch N/10" commits
```

Each push auto-deploys via GitHub Actions to the Timeweb Cloud VPS and the build
re-indexes the new articles.
Always set the exact `image: "/images/<slug>.jpg"` in frontmatter. Scripts
(fetch-openverse, generate-*-images, generate-previews) populate the jpgs + previews
before deploy; build + validate now hard gate correct fm + files.
