# SovetyDoma — план улучшений и аудит (2026-06-10)

Синтез после аудита безопасности (20 находок), разбора фабрики контента и
работы над автопубликацией/соцсетями. Полный security-отчёт — в комментарии
бида `sovetydoma-u15`.

## Что уже сделано в этой сессии

- **Facebook автопостинг с картинками** (`fb.ts`, `fb-autopost.ts`, admin-эндпоинты,
  cron-хук, миграция, тесты) — коммит `48fc3f4a`.
- **VK с картинками — диагностика и runbook** (`reports/vk-photo-token-howto-2026-06.md`).
  Причина провала: `photos.getWallUploadServer` требует ПОЛЬЗОВАТЕЛЬСКИЙ токен,
  не групповой. Код уже поддерживает `VK_PHOTO_ACCESS_TOKEN`.
- **Автопубликация без ручной пересборки** (`auto-publish.mjs` + `content-autopublish.yml`) —
  коммит `de4795f4`. Cron 10:00/17:00 МСК экспортирует готовые строки матрицы → MDX →
  push → деплой.
- **Анти-AI тон** (новый draft-template + `validate-style.mjs`) — коммит `72183e97`.
- **Security P0**: photo-upload CORS fail-closed + timing-safe сравнение токена.

## 30 идей улучшения (по приоритету)

### Безопасность (1–8)
1. Ротация всех живых ключей из `.env.local` (Supabase service role, Resend, Google, Yandex) + Unsplash из HANDOFF-RESUME.md. **[P0, sovetydoma-csv]**
2. photo-upload: fail-closed CORS + timingSafeEqual. **[done]**
3. Явные service_role RLS-политики на таблицы без политик (analytics_*, social_publications, recipient_social_actions, notification_rate_limits). **[sovetydoma-5sn]**
4. `revoke/grant` на `notification_check_rate_limit` (сейчас PUBLIC → DoS-вектор). **[sovetydoma-5sn]**
5. Хардненинг telegram-notify.yml от script injection через имя файла/заголовок. **[sovetydoma-6ma]**
6. OAuth callback: разрешать только same-origin redirect. **[sovetydoma-422]**
7. Валидация исходящих fetch в воркерах (SSRF: VK image prefix, SMS_PROVIDER_BASE_URL, хардкод Turnstile URL). **[sovetydoma-lig]**
8. CSP-заголовки на nginx + ответы воркеров. **[sovetydoma-e8r]**

### Контент-фабрика и автономность (9–15)
9. Локальная Windows scheduled task: прегенерация картинок (`matrix:images`) + черновиков (`matrix:drafts`) — чтобы матрица всегда имела approved-строки впереди cron. **[sovetydoma-6sq]**
10. Гейт качества в auto-publish: `validate-style --fail N` перед публикацией.
11. Авто-ревью черновика вторым проходом (саб-агент-редактор) перед approved.
12. Дедуп тем: эмбеддинги заголовков/описаний, чтобы не плодить близкие статьи.
13. Расписание разнообразия: ротация категорий при выборе строк на публикацию (не подряд одна рубрика).
14. Картинки: проверка уникальности (perceptual hash) до публикации, чтобы не повторять изображения.
15. Телеметрия фабрики: дашборд состояния матрицы (idea/draft/approved/published, images) в админке.

### SEO / Google Discover / возврат читателя (16–23)
16. **Article/NewsArticle JSON-LD** на каждой статье (author, datePublished, dateModified, image ≥1200px, publisher). Сейчас только frontmatter-мета. **[sovetydoma-qup]**
17. `<meta name="robots" content="max-image-preview:large">` — обязательное условие Discover.
18. og:image / twitter:image ≥1200px (Discover требует крупные изображения). Проверить, что генерим 1200px+.
19. Author/E-E-A-T страницы для персон (maryana-sidorova и др.): bio, фото, список статей, sameAs.
20. Web Push (VAPID) — «подписка на новые советы»: возвращает читателя без email. Бид расширить.
21. Email-дайджесты по интересам (инфраструктура подписок уже есть) + «снова в Google»: RSS уже есть, добавить `<lastBuildDate>`/ping.
22. Перелинковка: блок «Похожие статьи» + «Читают также» (внутренние ссылки повышают и SEO, и время на сайте).
23. Скорость LCP: проверить preload hero-изображения, `fetchpriority=high`, AVIF/WebP — Discord/Discover чувствительны к Core Web Vitals.

### Дашборд пользователя и вовлечение (24–28)
24. Персональная лента «Интересное вам» по истории чтения и сохранённым. **[sovetydoma-ceq]**
25. История просмотров + «продолжить чтение».
26. Управление подписками (категории/каналы) в одном месте кабинета.
27. Геймификация: серии чтения, бейджи, «прочитано N советов».
28. Email/push «новое в любимой рубрике» — крючок возврата.

### Эффективность (29–30, расширяется после efficiency-аудита)
29. vk-publication-index.json (~2.7 МБ) вынести из бандла воркера в KV/R2 или запрос к Supabase — уменьшить размер и холодный старт.
30. Кеш в CI: pnpm store + next cache; удалить мусорные root-каталоги (argparse/, gray-matter@4.0.3/ и т.д. — `sovetydoma-e3z`); общий кешируемый загрузчик статей вместо повторного парса 429 MDX в каждом скрипте.

## Открытые внешние шаги (нужен пользователь)
- Получить VK пользовательский токен (логин админа группы в браузере) → `VK_PHOTO_ACCESS_TOKEN`.
- Создать FB-приложение + Page Access Token → `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`.
- Завести GH-секреты для cron-публикации: `CONTENT_PUBLISH_PAT`, `MATRIX_SUPABASE_URL`, `MATRIX_SUPABASE_SERVICE_ROLE_KEY`.
- Применить миграцию `202606101200_social_publications_fb.sql`.
