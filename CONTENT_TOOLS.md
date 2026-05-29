# Content Tools / Инструменты контента

This project includes several Node.js scripts for content maintenance and SEO feed generation.
All scripts read articles from `src/content/articles/` and write output to `public/`.

---

## Scripts / Скрипты

### `node scripts/generate-turbo.mjs`
**EN:** Regenerates the Yandex Turbo Pages RSS feed at `public/turbo.xml`. Takes the 20 most recent articles, converts Markdown to HTML, and wraps content in the `<turbo:content>` format required by Yandex Webmaster. Set `NEXT_PUBLIC_YANDEX_METRIKA_ID` in your environment to embed your Metrika counter ID.

**RU:** Пересоздаёт RSS-ленту Яндекс.Турбо в `public/turbo.xml`. Берёт 20 последних статей, конвертирует Markdown в HTML и оборачивает контент в формат `<turbo:content>`, необходимый для Яндекс.Вебмастера. Задайте `NEXT_PUBLIC_YANDEX_METRIKA_ID` в переменных окружения, чтобы подставить идентификатор счётчика Метрики.

---

### `node scripts/generate-zen.mjs`
**EN:** Regenerates the Yandex Zen (dzen.ru) RSS feed at `public/zen.xml`. Produces a standard RSS 2.0 feed with full article HTML in `<content:encoded>`, compatible with the Dzen publisher import.

**RU:** Пересоздаёт RSS-ленту для Яндекс.Дзен (dzen.ru) в `public/zen.xml`. Формирует стандартный RSS 2.0 с полным HTML статьи в `<content:encoded>` — совместим с импортом в кабинете издателя Дзена.

---

### `node scripts/audit-links.mjs`
**EN:** Scans all articles for mentions of other article titles or slugs that are not linked. Prints a report of unlinked cross-references so editors can add internal links to improve SEO and navigation.

**RU:** Сканирует все статьи на наличие упоминаний других материалов сайта, которые не оформлены в виде ссылок. Выводит список неиспользованных перекрёстных ссылок — помогает редакторам улучшить внутреннюю перелинковку.

---

### `node scripts/check-freshness.mjs`
**EN:** Flags articles that are older than a configurable threshold (default: 180 days) and have not been updated recently. Prints a prioritized list so the editorial team knows which content needs a review or refresh.

**RU:** Находит статьи, которые не обновлялись дольше заданного порога (по умолчанию 180 дней). Выводит список в порядке приоритета, чтобы редакция знала, какие материалы нуждаются в проверке или обновлении.

---

## How to submit `turbo.xml` to Yandex Webmaster / Как добавить `turbo.xml` в Яндекс.Вебмастер

**EN:**
1. Go to [webmaster.yandex.ru](https://webmaster.yandex.ru) and open your site.
2. In the left menu select **Турбо-страницы** → **RSS-лента Турбо**.
3. Paste the feed URL: `https://pogovorim.vsedomatut.com/turbo.xml`
4. Click **Добавить** and wait for Yandex to validate and index the feed.
5. After validation, Turbo pages appear in the **Индексирование** section.

**RU:**
1. Откройте [webmaster.yandex.ru](https://webmaster.yandex.ru) и выберите ваш сайт.
2. В левом меню выберите **Турбо-страницы** → **RSS-лента Турбо**.
3. Вставьте адрес ленты: `https://pogovorim.vsedomatut.com/turbo.xml`
4. Нажмите **Добавить** и дождитесь проверки и индексации.
5. После валидации Турбо-страницы отобразятся в разделе **Индексирование**.

---

## Build integration / Интеграция в сборку

All feed scripts run automatically before `next build` via the `buildCommand` in `vercel.json`:

```
node scripts/generate-sitemap.mjs &&
node scripts/generate-rss.mjs &&
node scripts/generate-turbo.mjs &&
node scripts/generate-zen.mjs &&
npx next build
```

To regenerate feeds locally without building, run each script individually from the project root.
