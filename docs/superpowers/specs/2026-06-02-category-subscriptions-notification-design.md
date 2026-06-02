# Category subscriptions and notification delivery design

Дата: 2026-06-02
Статус: пересмотренный продуктово-технический драфт после внешних review и уточнения владельца продукта
Проект: `1001sovet.ru` / SovetyDoma

## Коротко

Нужно дать читателю возможность подписаться на одну или несколько категорий статей и получать ограниченное количество полезных уведомлений в выбранные каналы: email, Telegram, MAX, WhatsApp, SMS/телефон и соцсети. Это не просто newsletter: это система удержания аудитории, возврата на сайт и выращивания социальных каналов, которые позже можно монетизировать рекламой, партнерками и тематическими подборками.

Рекомендованный MVP: полноценная подписка на выбранные категории с выбором каналов с первого релиза. Каналы не должны быть "заглушками": email отправляется через Resend, Telegram и MAX подключаются через ботов/deep links, WhatsApp и SMS/телефон проходят через официальные provider/opt-in flows, а VK/Одноклассники/Facebook добавляются как социальные точки роста и CTA. При этом остаются production-guardrails: подтверждение каждого канала, rate limits, suppression list, one-click unsubscribe для email, idempotent delivery и `articles_publication_index` с `first_seen_at`.

Ключевой принцип: лимиты задаются на получателя, а не на категорию. Если человек подписан на 5 категорий и выбрал "1 раз в день", он получает одно сообщение/digest в день, а не 5 отдельных уведомлений.

## Текущий контекст проекта

Сайт сейчас является статическим Next.js export на Timeweb/nginx. Это хорошо для SEO и надежности, но статический сайт не может сам выполнять cron-рассылку, хранить серверные секреты или безопасно отправлять сообщения в Telegram/WhatsApp/MAX. Для подписок нужен отдельный runtime:

- Cloudflare Worker, уже есть в проекте для контактной формы, R2, view tracking и ограниченной email-отправки.
- Supabase Edge Function.
- Отдельный backend/API на `api.1001sovet.ru`.

У проекта уже есть:

- Supabase client и авторизация через Supabase Auth.
- Страница "Мой кабинет".
- Категории: `kulinaria`, `dom-i-uborka`, `dacha-i-ogorod`, `layfkhaki`, `ekonomiya`, `rybalka`.
- Существующая простая форма `NewsletterForm`, которая пишет email в `newsletter_subscribers` напрямую из клиента. В repo нет migration для этой таблицы, поэтому это schema drift и потенциальный spam vector; Phase 1 должна заменить ее server-side flow и зафиксировать схему в Supabase migrations.
- Cloudflare Worker `workers/photo-upload`, где есть отправка контактного email. Cloudflare Email binding в `wrangler.toml` привязан к одному `destination_address`, поэтому он непригоден для отправки произвольным подписчикам. Для category subscriptions Resend или другой ESP является обязательным, не fallback.
- Существующий `src/lib/article-index.json` генерируется `scripts/generate-article-index.mjs`, но он bundled в приложение и содержит только `category`/`title`. Его нельзя использовать как production-источник "новых" статей для scheduler.
- Почтовая инфраструктура Mailcow для человеческих ящиков `1001sovet.ru`, при этом для transactional/app email в существующем плане уже предпочтительнее Resend.

Вывод: не надо строить все с нуля. Нужно заменить простую newsletter-форму на полноценную подписку с подтверждением, предпочтениями, журналом отправок, publication index и серверным планировщиком.

## Решения после review и уточнения scope

Эти пункты считаются обязательными:

1. Cold start: новая подписка отправляет только статьи с `first_seen_at >= confirmed_at`, а не весь архив.
2. Источник новых статей: MVP использует Supabase `articles_publication_index` с `first_seen_at`; публичный JSON не подходит для watermark-логики.
3. Idempotency: digest delivery защищен unique constraint/claim lock, чтобы cron retry или overlap не отправили дубль.
4. Abuse protection: `/subscriptions/start` требует Turnstile и persistent per-IP/per-email throttle; in-memory `Map` в Worker для этого недостаточен.
5. Deliverability: Resend обязателен, нужен dedicated sending subdomain, SPF/DKIM/DMARC, bounce/complaint webhook и suppression list.
6. Unsubscribe: письма должны поддерживать `List-Unsubscribe` и `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, плюс обычную ссылку в теле письма.
7. Legal consent: хранить текст и версию согласия; sponsored/advertising content требует отдельного явного согласия.
8. Schema должна поддерживать несколько каналов сразу; не строить email-only модель, которую потом придется выбрасывать.
9. Пользователь выбирает частоту: `daily_one`, `daily_digest_3`, `weekly_digest_3`, `weekly_digest_7`. Default можно выбирать продуктово, но не убирать остальные режимы.
10. UI показывает выбор каналов сразу: email, Telegram, MAX, WhatsApp, SMS/телефон, VK, Одноклассники, Facebook.
11. Product framing: говорить "категории", "темы" и "полезная подборка", не прятать саму категорийную подписку.
12. Добавить admin diagnostics, success metrics, staged rollout и content eligibility, чтобы запуск не был слепым.
13. Соцсети являются частью стратегии вовлечения: нужны страницы VK, Одноклассники и Facebook, а также CTA, которые ведут людей туда.

## Цели

1. Читатель может подписаться на текущую категорию прямо со страницы статьи или категории.
2. Читатель может выбрать несколько категорий.
3. Подписка работает без регистрации, но авторизованный пользователь получает удобное управление в кабинете.
4. У каждого канала есть подтверждение владения контактом.
5. Читатель управляет частотой: "1 статья в день", "до 3 статей в день", "3 статьи в неделю", "1 дайджест в неделю".
6. Система не заваливает пользователя сообщениями: действует глобальный лимит на получателя, дедупликация и quiet hours.
7. В каждом сообщении есть понятная отписка и ссылка на управление настройками.
8. Архитектура позволяет добавлять новые каналы через адаптеры, не переписывая подписки.

## Не цели первого релиза

- Персонализация на базе сложной ML-модели.
- Немедленные push-уведомления по каждой новой статье.
- Фейковые "заглушки" каналов без реального confirmation/provider flow.
- Маркетинговые рассылки вне выбранных категорий.
- Массовая миграция всех пользователей в обязательную регистрацию.
- Полноценная CRM/маркетинговая платформа вне задач подписки и social growth.

## Сценарий пользователя

### Гость на странице статьи

1. Пользователь читает статью в категории "Дом и уборка".
2. Рядом с бейджем категории, в конце статьи и в блоке похожих статей он видит действие: "Подписаться на Дом и уборка".
3. Нажимает кнопку.
4. Открывается компактная форма:
   - текущая категория уже выбрана;
   - можно добавить другие категории;
   - пользователь выбирает один или несколько каналов: email, Telegram, MAX, WhatsApp, SMS/телефон;
   - рядом показываются социальные CTA: VK, Одноклассники, Facebook;
   - пользователь выбирает частоту;
   - есть короткое согласие на получение уведомлений и обработку контактов.
5. Пользователь вводит контакты только для выбранных каналов.
6. Каждый канал проходит подтверждение: email по письму, Telegram/MAX через бота, WhatsApp/SMS через официальный opt-in/OTP.
7. После подтверждения хотя бы одного канала подписка активна для этого канала.
8. Первое сообщение приходит в ближайший подходящий slot по выбранной частоте, а не сразу, чтобы ожидание частоты выполнялось с самого начала.

### Channel flow: Telegram

1. Пользователь выбирает Telegram.
2. Сайт создает pending-подписку и показывает кнопку "Открыть бота".
3. Кнопка ведет в Telegram по deep link с одноразовым токеном.
4. Пользователь нажимает Start в боте.
5. Бот получает `chat_id`, связывает его с pending-подпиской и отправляет короткое подтверждение.
6. Сайт показывает состояние "Telegram подключен".

Важно: бот не должен отправлять сообщения пользователю, пока пользователь сам не начал диалог с ботом.

### Channel flow: MAX

1. Flow похож на Telegram: сайт создает pending-подписку, затем ведет в MAX-бота по deep link.
2. MAX-бот получает payload и `chat_id` через webhook.
3. Канал становится активным после события запуска бота.

Ограничение: по актуальной документации MAX, подключение платформы партнеров и чат-ботов доступно юрлицам и ИП-резидентам РФ, бот проходит модерацию, production-уведомления должны идти через webhook/HTTPS, а стабильная работа требует держаться в лимите API. Поэтому MAX лучше включать после подтверждения юридического и операционного контура.

### Channel flow: WhatsApp или SMS

1. Пользователь вводит телефон.
2. Система показывает явное согласие: канал, частота, тип сообщений.
3. Телефон подтверждается OTP или провайдерским opt-in flow.
4. WhatsApp-канал использует только официальную WhatsApp Business Platform/Cloud API или проверенного BSP-провайдера, потому что неофициальная автоматизация личного WhatsApp непригодна для продукта.
5. Для ежедневных уведомлений WhatsApp почти наверняка потребует шаблоны сообщений и модерацию шаблонов. Это отдельный operational step, не просто "отправить текст".
6. SMS использовать осторожно: разрешить только при явном согласии и строгом лимите, потому что это дорогой и более раздражающий канал.

### Social follow flow: VK, Одноклассники, Facebook

1. В форме подписки есть блок "Следить в соцсетях".
2. Пользователь может открыть страницу VK, Одноклассники или Facebook и подписаться там.
3. Сайт не считает social follow подтвержденным notification channel, пока нет API/webhook-интеграции, но учитывает CTA click как growth metric.
4. Соцстраницы нужны не как заглушка, а как отдельные точки вовлечения и будущей монетизации.

### Авторизованный пользователь

1. Пользователь нажимает "Подписаться".
2. Если у аккаунта есть подтвержденный email, он уже подставлен.
3. Пользователь выбирает категории и частоту.
4. В "Мой кабинет" появляется вкладка "Подписки":
   - список категорий;
   - каналы доставки;
   - частота;
   - время доставки;
   - пауза;
   - отписка.
5. Если пользователь добавляет Telegram/MAX/телефон, каждый новый канал подтверждается отдельно.

## Где показывать подписку в интерфейсе

Минимальный набор точек входа:

1. Страница статьи:
   - маленькая кнопка рядом с категорией в header статьи: "Подписаться на эту категорию";
   - блок после статьи: "Получать новые советы по этой категории там, где удобно";
   - компактная ссылка в боковом TOC на desktop.

2. Страница категории:
   - кнопка в header категории: "Подписаться на категорию";
   - если статей много, повторить CTA после первой страницы/первого списка.

3. Футер/Newsletter:
   - заменить общий email newsletter на "Выберите категории и каналы" вместо безличной подписки.

4. "Мой кабинет":
   - вкладка "Подписки";
   - категории;
   - каналы;
   - частота;
   - статусы подтверждения;
   - пауза и отписка.

5. После сохранения статьи в избранное:
   - мягкое предложение: "Хотите получать новые советы из этой категории?"

6. Социальный блок:
   - "Следить в VK";
   - "Следить в Одноклассниках";
   - "Следить в Facebook";
   - показывать как отдельные social follow targets, не как direct notification channels.

## UX-форма подписки

Форма должна быть двухуровневой: простой режим и расширенные настройки.

### Простой режим по умолчанию

Поля:

- выбранная категория;
- дополнительные категории;
- каналы: email, Telegram, MAX, WhatsApp, SMS/телефон;
- социальные follow targets: VK, Одноклассники, Facebook;
- частота;
- чекбокс согласия;
- кнопка "Подписаться".

Это должно занимать не больше 1 экрана на мобильном.

Примеры CTA:

- "Раз в неделю - 3 лучших новых совета по выбранным темам"
- "Получать короткую подборку полезных советов без спама"
- "Не пропускать новые советы для дома и дачи"
- "Присылать новые советы по уборке раз в неделю"
- "Получать советы в Telegram, MAX, WhatsApp или на email"

### Расширенные настройки

Открываются ссылкой "Настроить подробнее".

Настройки:

- Категории: мультивыбор.
- Каналы: email, Telegram, MAX, WhatsApp, SMS/телефон.
- Соцсети: VK, Одноклассники, Facebook.
- Частота:
  - 1 статья в день;
  - до 3 статей в день;
  - 3 статьи в неделю;
  - 1 дайджест в неделю;
  - future: только срочные/важные подборки, если появится редакционный флаг.
- Время доставки:
  - утро;
  - день;
  - вечер;
  - конкретный час.
- Часовой пояс:
  - определить из браузера;
  - дать изменить.
- Режим контента:
  - только новые статьи;
  - evergreen-рекомендации не входят в MVP.

Рекомендация для первого экрана: показывать выбранную категорию, email и быстрые кнопки Telegram/MAX/WhatsApp, а остальные настройки раскрывать без скрытия самих каналов. Нельзя убирать каналы из flow, но можно делать прогрессивное раскрытие деталей.

## Частота и антиспам-логика

Главный риск: человек подписался на несколько категорий, а система начала слать слишком много. Поэтому правила должны быть такими:

1. Лимит применяется к контакту/получателю глобально.
2. Одна отправка может содержать несколько статей, но в рамках выбранного лимита.
3. Нельзя отправлять одну и ту же статью одному получателю повторно.
4. Если новых статей нет, система по умолчанию молчит.
5. Evergreen-рекомендации можно включать только отдельной настройкой.
6. В Phase 1 можно выбрать несколько каналов, но каждый канал должен иметь отдельный статус подтверждения и отдельную доставку.
7. Новая подписка не получает старый архив. Ее стартовый watermark равен `confirmed_at`.

### Рекомендуемые пресеты частоты

`daily_one`:

- максимум 1 сообщение в день;
- максимум 1 статья в сообщении;
- отправлять только если есть подходящая новая статья.

`daily_digest_3`:

- максимум 1 сообщение в день;
- до 3 статей внутри сообщения;
- подходит для нескольких категорий.

`weekly_digest_3`:

- 1 сообщение в неделю;
- до 3 статей;
- лучший вариант для осторожного WhatsApp/SMS.

`weekly_digest_7`:

- 1 сообщение в неделю;
- до 7 статей;
- только email/Telegram/MAX, не SMS.

### Алгоритм выбора статей

Для каждого активного получателя scheduler делает:

1. Получить активные категории подписки.
2. Получить статьи из этих категорий, у которых `first_seen_at` больше или равно watermark подписки. Для новой подписки watermark = `confirmed_at`; для существующей = последний успешно обработанный delivery slot.
3. Исключить статьи из `notification_delivery_items`, которые уже отправлялись этому получателю.
4. Отсортировать:
   - свежие `first_seen_at` выше;
   - категории, где пользователь давно не получал контент, выше;
   - статьи с лучшими редакционными сигналами выше, если такие сигналы появятся;
   - не отправлять sponsored/partner content, если пользователь не дал отдельное согласие.
5. Обрезать до лимита пресета.
6. Если список пустой, не отправлять.
7. Создать delivery claim для `(subscription_id, slot_date)` или эквивалентный lock. Если claim уже есть, пропустить отправку.
8. Записать попытку доставки и фактически отправленные article slugs.

### Что делать, если статей много

Если за день вышло 10 статей по выбранным категориям, а лимит пользователя "1 статья в день":

- отправить только лучшую/самую свежую;
- остальные оставить в backlog;
- на следующий день снова выбрать из backlog и новых статей;
- если backlog стал старше, например, 14 дней, больше не отправлять его автоматически.

Так пользователь получает постоянную пользу, но не ощущает поток спама.

## Архитектура

### Рекомендованный вариант

Использовать Supabase как хранилище подписок и Cloudflare Worker как API + scheduler + provider gateway.

Почему:

- статический Next.js не подходит для cron и секретов;
- Cloudflare Worker уже есть в проекте;
- Worker может иметь secrets для Resend, Telegram, MAX, WhatsApp/SMS провайдеров;
- Supabase уже используется для авторизации и пользовательских данных;
- архитектура не требует превращать весь сайт в server-rendered app.

### Альтернативы

#### Вариант A: email-first через Supabase Edge Functions

Плюсы:

- ближе к Supabase Auth и базе;
- проще SQL/RPC-интеграция;
- хороший вариант для подтверждения email и RLS.

Минусы:

- Telegram/MAX/WhatsApp webhooks и provider gateway могут стать менее удобными;
- в проекте уже есть Cloudflare Worker для внешних форм и email.

#### Вариант B: Cloudflare Worker + Supabase

Плюсы:

- лучший fit для текущего статического продакшена;
- один runtime для API, webhooks, cron и отправки;
- удобно держать provider secrets;
- легко вынести на `api.1001sovet.ru`.

Минусы:

- нужно аккуратно работать с Supabase service role key в Worker secrets;
- понадобится отдельная RLS/безопасная модель публичных API.

Рекомендация: выбрать Вариант B.

#### Вариант C: полноценный backend/API на VPS

Плюсы:

- больше контроля;
- проще долгие job-очереди и observability.

Минусы:

- текущий продакшен статический и Docker на Timeweb не используется;
- выше операционная нагрузка;
- преждевременно для MVP.

Рекомендация: не брать для первого релиза.

## Данные

Ниже базовая omnichannel schema для первого релиза. Она не должна быть email-only, иначе второй канал потребует переписывать фундамент.

### `notification_recipients`

Один получатель: гость или авторизованный пользователь. Лимиты, частота и дедупликация считаются на этом уровне.

Поля:

- `id`
- `user_id` nullable, если гость
- `anonymous_token_hash` nullable
- `status`: `active`, `paused`, `unsubscribed`, `suppressed`
- `frequency`: `daily_one`, `daily_digest_3`, `weekly_digest_3`, `weekly_digest_7`
- `timezone`
- `preferred_send_hour`
- `content_mode`: `new_only` для MVP
- `management_token_hash`
- `created_at`
- `updated_at`

### `notification_contacts`

Контакт или provider identity для прямого канала.

Поля:

- `id`
- `recipient_id`
- `channel`: `email`, `telegram`, `max`, `whatsapp`, `sms`, `phone`
- `address`: email, phone E.164 или provider chat id
- `address_hash`
- `display_address`
- `provider_user_id` nullable
- `provider_chat_id` nullable
- `status`: `pending`, `confirmed`, `failed`, `suppressed`, `unsubscribed`
- `confirmed_at`
- `last_verified_at`
- `created_at`
- `updated_at`

### `notification_topic_subscriptions`

Выбранные категории.

Поля:

- `recipient_id`
- `category_slug`
- `source`: `article`, `category_page`, `footer`, `cabinet`, `social_cta`
- `source_article_slug` nullable
- `status`: `active`, `paused`, `unsubscribed`
- `created_at`

### `notification_channel_preferences`

Переключатели каналов и отдельные настройки.

Поля:

- `recipient_id`
- `channel`
- `enabled`
- `priority`
- `frequency_override` nullable
- `send_hour_override` nullable
- `status`: `pending_confirmation`, `active`, `paused`, `unsubscribed`, `provider_gated`
- `created_at`
- `updated_at`

### `social_follow_targets`

Соцсети как growth surfaces. Они не заменяют direct message channels.

Поля:

- `id`
- `platform`: `vk`, `ok`, `facebook`
- `page_url`
- `status`: `planned`, `active`, `disabled`
- `created_at`
- `updated_at`

### `recipient_social_actions`

Отслеживание переходов к соцстраницам.

Поля:

- `recipient_id` nullable
- `platform`
- `source`
- `source_article_slug` nullable
- `clicked_at`

### `notification_confirmations`

Одноразовые подтверждения для email, bot deep links, phone OTP и provider opt-in.

Поля:

- `id`
- `recipient_id`
- `contact_id`
- `channel`
- `token_hash`
- `expires_at`
- `used_at`
- `created_ip_hash`
- `created_user_agent_hash`

### `notification_consents`

Ledger согласий.

Поля:

- `id`
- `recipient_id`
- `contact_id` nullable
- `channel`
- `consent_type`: `personal_data`, `service_notifications`, `advertising`, `messenger_opt_in`, `sms_opt_in`
- `text_version`
- `text_snapshot`
- `accepted_at`
- `ip_hash`
- `user_agent_hash`

`articles_publication_index`

Канонический источник новых статей для scheduler.

Поля:

- `slug`
- `category_slug`
- `title`
- `description`
- `canonical_path`
- `frontmatter_date`
- `reading_minutes`
- `sponsored`
- `notification_eligible`
- `notification_priority`
- `evergreen_score`
- `first_seen_at`
- `last_seen_at`
- `content_hash` nullable

Правило: `first_seen_at` задается в момент первого появления slug в build/scheduler ingest и больше не меняется. `frontmatter_date` остается editorial metadata и не используется как watermark для рассылки.

`notification_deliveries`

Поля:

- `id`
- `recipient_id`
- `contact_id`
- `channel`
- `slot_date`: локальная дата/слот подписки
- `status`: `claimed`, `sent`, `failed`, `skipped`, `bounced`
- `provider_message_id`
- `error_code`
- `sent_at`
- `created_at`

Ограничение: unique `(recipient_id, channel, slot_date)`, либо эквивалентный claim lock, чтобы overlap/retry cron не отправлял дубль по одному каналу.

`notification_delivery_items`

Поля:

- `delivery_id`
- `article_slug`
- `category_slug`

`notification_suppression_list`

Поля:

- `channel`
- `address_hash`
- `reason`: `unsubscribe`, `bounce`, `complaint`, `admin_block`
- `provider_event_id` nullable
- `created_at`

`newsletter_subscribers` migration cleanup

Существующая таблица должна быть либо мигрирована в новую модель, либо закрыта:

- добавить migration, если таблицу нужно временно оставить;
- запретить прямой anon insert без server-side abuse controls;
- перевести `NewsletterForm` на Worker `/subscriptions/start`;
- импортировать существующие записи только как `pending` или `active` после проверки, что есть корректное согласие.

## Источник статей для scheduler

Статьи сейчас лежат в MDX и индексируются на build. Worker не может читать `src/content/articles` напрямую в продакшене. В repo уже есть `src/lib/article-index.json`, но он нужен клиентским компонентам и содержит только `category`/`title`; он не публичный production source и не содержит `first_seen_at`, description, reading time или content hash.

Phase 1 recommendation: синхронизировать metadata статей в Supabase `articles_publication_index` на build или отдельным ingest job.

Правила:

1. Если slug новый, insert с `first_seen_at = now()`.
2. Если slug уже есть, обновить `last_seen_at`, title/description/path/category/content hash, но не менять `first_seen_at`.
3. Frontmatter `date` хранить как `frontmatter_date`, но не использовать как publish watermark: статьи могут попадать в repo пачками, а editorial date не равен production first-seen time.
4. Scheduler читает только `articles_publication_index`.
5. Публичный JSON можно добавить позже как cache/debug artifact, но он не должен быть источником idempotency или freshness.

## API endpoints

Если выбрать Cloudflare Worker, нужны endpoints:

`POST /subscriptions/start`

- вход: категории, канал, контакт, частота, timezone, consent flags, consent text version, Turnstile token;
- действие: проверяет Turnstile, persistent throttle per IP/email, suppression list, затем создает subscription/confirmation;
- возвращает masked contact и следующий шаг подтверждения.

`GET /subscriptions/confirm?token=...`

- подтверждает email/SMS/WhatsApp OTP или web confirmation;
- активирует contact и subscription.

`POST /subscriptions/manage`

- принимает management token или Supabase auth session;
- возвращает настройки подписки.

`PATCH /subscriptions/:id`

- меняет категории, частоту, время, каналы.

`POST /subscriptions/:id/pause`

- ставит подписку на паузу.

`POST /subscriptions/:id/unsubscribe`

- отписывает от конкретной подписки или от всех уведомлений.

`POST /subscriptions/one-click-unsubscribe`

- принимает RFC 8058 one-click POST с `List-Unsubscribe=One-Click`;
- работает без login;
- не показывает preference UI;
- idempotently переводит подписку или конкретный list scope в `unsubscribed`.

`POST /webhooks/resend`

- принимает bounce/complaint/delivery events от Resend;
- записывает hard bounces и complaints в `notification_suppression_list`;
- обновляет `notification_deliveries` по `provider_message_id`.

`POST /webhooks/telegram`

- принимает Telegram updates.

`POST /webhooks/max`

- принимает MAX updates.

`POST /webhooks/whatsapp`

- принимает WhatsApp delivery/user events, если канал будет включен.

`POST /cron/send-digests`

- внутренний/scheduled endpoint; выбирает получателей и отправляет digest.
- Cloudflare cron cadence для Phase 1: hourly, например `[triggers] crons = ["0 * * * *"]`.
- Каждый час выбираются active subscriptions, у которых локальный час (`timezone` + current UTC time) совпадает с `preferred_send_hour`, и которые еще не имеют delivery claim на текущий `slot_date`.

## Provider adapters

Все каналы должны иметь общий интерфейс:

- `prepareConfirmation(contact, subscription)`
- `handleInboundWebhook(event)`
- `sendDigest(contact, message)`
- `normalizeDeliveryStatus(event)`
- `supportsFrequencyPreset(preset)`

### Email

MVP-канал.

Требования:

- double opt-in;
- отправка через Resend как обязательный ESP для subscriber email; Cloudflare Email binding в текущем Worker не подходит для произвольных подписчиков;
- dedicated sending subdomain, например `mail.1001sovet.ru` или `news.1001sovet.ru`, чтобы не рисковать репутацией root domain;
- SPF, DKIM и DMARC должны быть verified у Resend до production send;
- `List-Unsubscribe`;
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`;
- обычная видимая ссылка отписки в теле письма;
- `POST /subscriptions/one-click-unsubscribe` должен выполнять unsubscribe без login и без дополнительных шагов;
- Resend webhook для bounces/complaints должен пополнять suppression list;
- текстовая и HTML-версия;
- понятное поле From, например `SovetyDoma <digest@mail.1001sovet.ru>` после DNS/доменных проверок.

Mailcow остается для человеческих ящиков. Для массовых/transactional уведомлений использовать Resend или другой доставочный сервис, потому что нужны managed reputation, bounce processing, complaint events и unsubscribe headers.

### Telegram

Хороший второй канал.

Требования:

- Telegram bot token в Worker secrets;
- deep link с одноразовым payload;
- webhook с secret token;
- хранить `chat_id`, не username как главный адрес;
- команды `/settings`, `/pause`, `/unsubscribe`;
- не слать, пока пользователь не начал диалог.

### MAX

Проектировать сразу, включать после operational review.

Требования:

- подтвержденная организация на платформе MAX для партнеров;
- модерация бота;
- HTTPS webhook;
- deep link payload для связывания pending-подписки;
- хранить `chat_id`;
- лимитировать API-запросы.

### WhatsApp

Не MVP.

Требования:

- официальная WhatsApp Business Platform/Cloud API или BSP;
- бизнес-верификация и телефон;
- opt-in пользователя;
- шаблоны сообщений для outbound уведомлений;
- обработка статусов доставки и отписок;
- отдельная оценка стоимости.

Риск: WhatsApp может быть дорогим и медленным в запуске из-за шаблонов, категорий сообщений и модерации.

### SMS

Не MVP.

Требования:

- выбор провайдера;
- OTP/подтверждение телефона;
- короткие тексты;
- строгие лимиты частоты;
- стоимость за сообщение;
- отписка через ссылку или keyword, если провайдер поддерживает.

SMS лучше использовать как fallback/важный канал, а не как основной канал ежедневных статей.

## Формат сообщений

### Email daily one

Тема:

`Новый совет в разделе "Дом и уборка": как быстро убрать кухню`

Тело:

- заголовок статьи;
- 1-2 предложения описания;
- категория;
- время чтения;
- кнопка "Читать";
- ссылка "Настроить подписку";
- ссылка "Отписаться".

### Email digest 3

Тема:

`3 новых совета по дому и экономии`

Тело:

- короткое intro;
- список до 3 статей;
- для каждой: категория, заголовок, описание, ссылка;
- настройки и отписка.

### Telegram/MAX

Одно короткое сообщение:

`Дом и уборка: Как отмыть духовку без едкой химии`

Дальше:

- краткое описание;
- ссылка на статью;
- inline кнопки или команды: "Настройки", "Пауза", "Отписаться".

### WhatsApp/SMS

Максимально коротко, особенно SMS:

`1001sovet.ru: новая статья "Как отмыть духовку без едкой химии" - https://... Отписка: https://...`

Для WhatsApp текст должен соответствовать утвержденному шаблону, если сообщение инициируется бизнесом вне пользовательского окна.

## Управление подпиской

У каждого сообщения должна быть ссылка управления. Для гостей ссылка использует management token, не требующий входа. Для авторизованных пользователей ссылка ведет в "Мой кабинет".

Действия:

- изменить категории;
- изменить частоту;
- изменить время доставки;
- сменить канал;
- добавить канал;
- поставить на паузу на 7/30 дней;
- отписаться от одной категории;
- отписаться от всех уведомлений.

Важно: отписка должна быть проще, чем подписка. Не заставлять пользователя логиниться для unsubscribe.

## Admin diagnostics

Нельзя запускать omnichannel delivery вслепую. Минимальный admin/ops surface:

- pending/confirmed/unsubscribed по каналам;
- подписчики по категориям;
- delivery attempts за день/неделю;
- failed/bounced/complaint по провайдерам;
- последние ошибки Resend/Telegram/MAX/WhatsApp/SMS;
- какие статьи попали в digest;
- dry-run следующей рассылки;
- ручной test-send на свой email/Telegram/MAX/WhatsApp/SMS;
- suppressed contacts без раскрытия полного email/phone/chat id;
- social CTA clicks по VK/OK/Facebook;
- provider readiness: credentials present, webhook verified, last successful send.

## Success metrics

Метрики нужны, чтобы понять, строим ли мы retention или просто сложную систему доставки.

- subscription conversion rate по статье и категории;
- channel selection mix: email/Telegram/MAX/WhatsApp/SMS/social;
- confirmation rate по каждому каналу;
- delivery success rate по каждому каналу;
- open/click rate для email;
- click-through из Telegram/MAX/WhatsApp/SMS;
- digest-to-pageview return rate;
- unsubscribe rate;
- complaint/bounce rate;
- social follow CTA click rate;
- подписчики по категориям;
- доля пользователей с 2+ категориями;
- доля пользователей с 2+ каналами.

## Rollout plan

Даже при реализации всех каналов сразу запуск должен быть управляемым:

1. Internal QA: только тестовые контакты владельца/команды по всем каналам.
2. Provider QA: проверить webhooks, opt-in, delivery status и отписку по каждому каналу.
3. Hidden CTA: включить форму на одной категории и одном-двух статьях.
4. Limited category rollout: включить 10-20% статей в одной категории.
5. Full category rollout: включить все статьи выбранной категории.
6. Site-wide rollout: включить все категории.
7. Social growth rollout: добавить VK/OK/Facebook CTA в footer, article end block и subscription success screen.

На каждом этапе стоп-условия:

- высокий complaint/bounce rate;
- повторные доставки из-за idempotency bug;
- провайдерские ошибки webhook/send;
- заметный рост unsubscribe сразу после первого digest;
- неработающая отписка или management link.

## Beads issue structure

В текущем checkout `bd` был инициализирован 2026-06-02. Создан epic `sovetydoma-7md` и дочерние задачи `sovetydoma-7md.1` ... `sovetydoma-7md.7`:

1. Epic: `Omnichannel category subscriptions for selected categories`
   - labels: `epic`, `subscriptions`, `omnichannel`, `no-tech-debt`
   - acceptance: users can subscribe by category, choose delivery channels from day one, confirm/manage/unsubscribe, and social follow targets are visible and tracked.

2. `Define omnichannel subscription data model and preference rules`
   - labels: `backend`, `data-model`, `subscriptions`, `no-tech-debt`
   - acceptance: stores recipients, selected categories, per-channel opt-in/status, social follow targets, consent ledger, delivery ledger, suppression.

3. `Build subscription UI for category and channel selection`
   - labels: `frontend`, `ux`, `subscriptions`
   - acceptance: users select categories and channels in one flow, edit choices later, and see per-channel confirmation/status/errors.

4. `Implement delivery pipeline for all direct channels`
   - labels: `backend`, `integration`, `email`, `telegram`, `max`, `whatsapp`, `sms`
   - acceptance: publish/digest job fans out to opted-in confirmed direct channels with idempotency, retries and per-channel failure isolation.

5. `Add VK, Odnoklassniki and Facebook social follow targets`
   - labels: `social`, `integration`, `frontend`
   - acceptance: social pages are created/linked, surfaced as first-class follow targets, and CTA clicks are tracked.

6. `Add subscription audit trail and operator visibility`
   - labels: `ops`, `admin`, `observability`
   - acceptance: admins can inspect subscriptions, channel status, provider readiness, delivery history, failures, suppressed contacts and dry-runs.

7. `Cover omnichannel subscription flows with tests`
   - labels: `qa`, `tests`, `release`
   - acceptance: tests cover category selection, each direct channel, social links, opt-out, duplicate suppression, provider failure and delivery retry.

## Безопасность и приватность

1. Не хранить provider secrets в статическом Next.js.
2. Все provider secrets хранить в Worker secrets или выбранном backend runtime.
3. Email/phone/chat IDs не выводить в логи в открытом виде.
4. Использовать token hash в базе, не хранить plaintext confirmation token.
5. Confirmation tokens короткоживущие: например, 24 часа.
6. Management tokens можно сделать долгоживущими, но хранить только hash и разрешать только операции подписки, не доступ к аккаунту.
7. `POST /subscriptions/start` защищать Turnstile с первого дня.
8. RLS: авторизованный пользователь видит только свои подписки; guest-подписки доступны только по management token.
9. Rate limit должен быть persistent, а не in-memory `Map`: Cloudflare KV, Durable Object или Supabase table/RPC для per-IP/per-email throttling.
10. В каждом канале хранить отдельное согласие.
11. Хранить `consent_text_version` и snapshot текста согласия, чтобы можно было доказать, на что именно согласился пользователь.
12. Хранить IP/UA только как hash, если нет явной необходимости хранить raw values.
13. Sponsored/advertising content не слать без отдельного согласия; `advertising_consent` по умолчанию `false`.
14. Не отправлять подписочные письма на адреса в suppression list.
15. One-click unsubscribe и обычная ссылка отписки должны работать без login и быть idempotent.

## Операционные ограничения каналов

Проверено по публичной документации на 2026-06-02:

- Telegram Bot API поддерживает HTTPS webhooks и bot token authentication: https://core.telegram.org/bots/api
- MAX API поддерживает bot API, webhooks, deep links и требует production webhook по HTTPS; MAX для партнеров ограничен юрлицами/ИП-резидентами РФ: https://dev.max.ru/docs/chatbots/bots-coding/prepare и https://dev.max.ru/docs-api
- WhatsApp нужно вести через официальную Meta WhatsApp Business Platform/Cloud API или BSP: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Gmail sender guidelines требуют one-click unsubscribe для subscribed/bulk messages через `List-Unsubscribe` и `List-Unsubscribe-Post: List-Unsubscribe=One-Click`: https://support.google.com/mail/answer/81126
- Yahoo Sender Hub также описывает one-click unsubscribe по RFC 8058: https://senders.yahooinc.com/subhub/
- 152-ФЗ требует конкретного, предметного, информированного, сознательного и однозначного согласия на обработку персональных данных; оператор несет обязанность доказать получение согласия: https://ips.pravo.gov.ru/api/ips/legislation/document?baseid=None&hash=98490812b3409e2a8d78a11ca9010f434ea3d9250a11dbbdb78690cd5551bdd6
- 38-ФЗ для рекламы по сетям электросвязи требует предварительного согласия адресата, а обязанность доказать согласие лежит на рекламораспространителе: https://www.consultant.ru/document/cons_doc_LAW_511577/f892dec1383709792452f18d36e7043306e2be0a/

Перед implementation review нужно отдельно подтвердить:

- есть ли готовность подключать MAX как юрлицо/ИП;
- какой телефон и бизнес-аккаунт использовать для WhatsApp;
- какой SMS-провайдер подходит по цене и региону;
- какой sender domain использовать для email: `1001sovet.ru` или отдельный поддомен.
- кто утверждает текст согласия на обработку персональных данных и отдельный текст рекламного согласия.

## MVP scope

### Фаза 1: Omnichannel category subscriptions

Что входит:

- кнопка "Подписаться на категорию" на статье и странице категории;
- форма выбора одной или нескольких категорий;
- выбор каналов с первого релиза: email, Telegram, MAX, WhatsApp, SMS/телефон;
- social follow targets: VK, Одноклассники, Facebook;
- Supabase omnichannel schema: recipients, contacts, channel preferences, topic subscriptions, confirmations, consents, deliveries, suppression, social actions;
- cleanup/migration для старой `newsletter_subscribers`;
- `articles_publication_index` с `first_seen_at`;
- Resend email adapter с double opt-in, one-click unsubscribe, bounce/complaint webhook;
- Telegram bot adapter с deep link, webhook, `/settings`, `/pause`, `/unsubscribe`;
- MAX bot adapter с deep link/webhook и provider gating, если юридический/платформенный контур еще не готов;
- WhatsApp adapter через official Cloud API/BSP, opt-in и template handling;
- SMS/phone adapter через выбранного провайдера, OTP/opt-in и строгие лимиты;
- unified delivery scheduler с per-channel fan-out, idempotency, retries, failure isolation;
- Turnstile + persistent throttling на `/subscriptions/start`;
- unsubscribe/manage link;
- вкладка "Подписки" в кабинете;
- admin diagnostics: dry-run, test-send, delivery history, provider errors, suppressed contacts;
- staged rollout.

Что не входит:

- неофициальная автоматизация личного WhatsApp;
- отправка sponsored/advertising content без отдельного согласия;
- ML-персонализация;
- CRM вне задач подписки и социальных каналов.

### Provider-gated, но не omitted

Эти каналы остаются в UI, data model и implementation plan, но production delivery зависит от реальных credentials/юридических условий:

- Telegram: нужен bot token и webhook.
- MAX: нужны bot/app credentials, модерация и юрлицо/ИП-контур, если платформа этого требует.
- WhatsApp: нужен официальный Business/Cloud API или BSP, opt-in и approved templates.
- SMS/phone: нужен провайдер, стоимость, sender rules и OTP/opt-in.
- VK/Одноклассники/Facebook: нужны созданные страницы, оформление, ссылки и контентный план.

## Предлагаемый implementation plan после ревью

1. Зафиксировать product decisions:
   - какие категории доступны;
   - какие частоты показывать на первом экране;
   - какие соцстраницы создаем: VK, Одноклассники, Facebook;
   - какие provider credentials нужны для каждого direct channel;
   - какие каналы разрешены для sponsored/advertising content после отдельного согласия.

2. Добавить Supabase migrations:
   - `notification_recipients`;
   - `notification_contacts`;
   - `notification_topic_subscriptions`;
   - `notification_channel_preferences`;
   - `notification_confirmations`;
   - `notification_consents`;
   - `articles_publication_index`;
   - `notification_deliveries`;
   - `notification_delivery_items`;
   - `notification_suppression_list`;
   - `social_follow_targets`;
   - `recipient_social_actions`;
   - cleanup/migration для `newsletter_subscribers`.

3. Добавить Worker API:
   - start subscription;
   - confirm channel;
   - manage/unsubscribe;
   - one-click email unsubscribe;
   - webhooks: Resend, Telegram, MAX, WhatsApp, SMS provider;
   - scheduled digest;
   - persistent throttle store/RPC.

4. Добавить provider adapters:
   - email/Resend;
   - Telegram bot;
   - MAX bot;
   - WhatsApp Cloud API/BSP;
   - SMS/phone provider;
   - social follow tracking for VK/OK/Facebook CTA clicks.

5. Обновить UI:
   - subscription modal with categories + channels;
   - CTA на article/category pages;
   - замена `NewsletterForm`;
   - вкладка "Подписки" в кабинете;
   - social follow block.

6. Создать и оформить соцстраницы:
   - VK;
   - Одноклассники;
   - Facebook;
   - добавить ссылки в сайт, форму подписки и footer.

7. Добавить article publication ingest:
   - build/scheduler ingest в Supabase;
   - immutable `first_seen_at`;
   - не использовать frontmatter date как delivery watermark.

8. Добавить тесты:
   - unit для выбора статей и лимитов;
   - Worker tests для API;
   - idempotency test for duplicate cron slots;
   - abuse-control tests for `/subscriptions/start`;
   - tests для per-channel confirmation;
   - tests для social CTA tracking;
   - миграционные проверки RLS;
   - e2e happy path subscribe/confirm/unsubscribe for each direct channel that has credentials.

9. Production verification:
   - подписка тестовых контактов по всем каналам;
   - подтверждение каждого канала;
   - cron/digest dry run;
   - реальная отправка по каждому enabled provider;
   - отписка;
   - one-click unsubscribe POST;
   - simulated Resend bounce/complaint suppression;
   - webhook smoke for Telegram/MAX/WhatsApp/SMS providers;
   - social CTA click tracking;
   - проверка, что повторная отправка не дублирует статью.

## Вопросы для ревью

Решения, зафиксированные после review и уточнения владельца продукта:

1. Если новых статей нет, digest молчит. Evergreen fallback не входит в первый релиз.
2. Пользователь выбирает частоту; `daily_one` и weekly presets доступны.
3. Каналы показываются и реализуются с первого релиза: email, Telegram, MAX, WhatsApp, SMS/телефон.
4. VK, Одноклассники и Facebook входят как social growth surfaces.
5. Sponsored/partner/advertising content требует отдельного согласия.

Открытые вопросы перед implementation:

1. Какой dedicated sending subdomain использовать: `mail.1001sovet.ru`, `news.1001sovet.ru` или другой?
2. Кто утверждает текст согласия на обработку персональных данных и отдельный текст рекламного согласия?
3. Где лучше держать persistent throttle для `/subscriptions/start`: Cloudflare KV, Durable Object или Supabase RPC/table?
4. Нужен ли отдельный `api.1001sovet.ru` route для Worker до первого релиза, или достаточно текущего workers.dev endpoint на время QA?
5. Какие провайдеры выбираем для WhatsApp/SMS/phone?
6. Кто создает и владеет страницами VK, Одноклассники, Facebook?

## Рекомендация

Я бы запускал так:

1. Первый релиз: selected categories + selected channels, with real confirmation/status for every channel.
2. Email: live via Resend with deliverability, unsubscribe, suppression.
3. Telegram/MAX: live through bots when credentials/moderation are ready; no hidden UI, no fake state.
4. WhatsApp/SMS: official providers only, with opt-in/OTP and strict frequency.
5. VK/Одноклассники/Facebook: create pages, link from subscription flow, track clicks, use them as audience growth surfaces.

Так мы вовлекаем аудиторию сразу, не прячем каналы, не создаем email-only техдолг и одновременно сохраняем production-качество: подтверждения, лимиты, отписка, журнал доставки и provider-specific safety.
