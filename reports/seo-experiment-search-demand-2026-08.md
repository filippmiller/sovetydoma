# SEO-эксперимент: 10 статей по подтвержденному спросу — search-demand-2026-08

Постоянный журнал эксперимента. Машиночитаемый реестр: [seo-experiment-search-demand-2026-08.json](./seo-experiment-search-demand-2026-08.json).
Ветка: `content/seo-search-demand-2026-08`. Beads-эпик: `sovetydoma-9nb`.
Домен: **1001sovet.ru** (подтверждено: `content_matrix.domain` default, `next.config.ts` `siteUrl`).

## Этап 1 — Аудит (завершен 2026-08-02)

Проверка велась через прямые SQL-запросы к `content_matrix` (Supabase, project `plwkjdpuxjkmpkqiqzkk`), 2164 строки на момент аудита (429 published, 1339 idea). Полные результаты — bead `sovetydoma-9nb.1`.

| # | Тема | Решение | Причина |
|---|---|---|---|
| 1 | Фитофтора на помидорах | UPDATE | idea-строка `fitoftora-tomaty-profilaktika-obrabotka`, картинка готова |
| 2 | Стерилизация банок | UPDATE | idea-строка `sterilizatsiya-banok-ogurtsy-dukhovka-par`, сужена под огурцы — расширена под общий запрос |
| 3 | Стиральная машина не сливает | NEW | совпадений нет |
| 4 | Холодильник не морозит | NEW | смежная строка про чистку No Frost — другой интент |
| 5 | Пищевая моль | UPDATE | idea-строка `pishchevaya-mol-kukhnya`, картинка готова; строки про моль в шкафу — другой вредитель, не дубль |
| 6 | Хранение чеснока | UPDATE | idea-строка `khranenie-chesnoka-sushka-pletyonki`, картинка готова |
| 7 | Вода под ящиками холодильника | NEW | совпадений нет |
| 8 | Заморозка петрушки | UPDATE | idea-строка `zamorozka-petrushki-sokhr-arom`, картинка готова |
| 9 | Посудомойка белый налет | NEW | совпадений нет |
| 10 | Кабачки гниют на кусте | NEW | смежная строка `kabachki-gniut-pri-khranenii-prichiny` — гниение ПРИ ХРАНЕНИИ, другой интент, чем гниение завязей на кусте; связаны перекрёстной ссылкой |

**Историческая контрольная когорта** (10 статей, май 2026, не выбирались по трендам — использованы как есть, без изменений):
`ekonomiya-na-produktakh`, `starye-dzhinsy`, `ogurcy-ot-tli`, `kogda-sazhat-pomidory-2026`, `skovoroda-ot-zhira`, `nakip-v-chaynike`, `klubnika-na-podokonnike`, `testo-dlya-pelmeney`, `podkormka-pomidorov`, `kompost-bystro`.

**Публикация**: no-redeploy pipeline (bead `sovetydoma-0q8`). Черновик → `.matrix-ideas/drafts/<slug>.md` → `ingest-drafts-batch.mjs` → `promote-drafts.mjs` (гейт качества) → `publish-dynamic.mjs --slugs ...` (реальная публикация в БД + R2, без git/ребилда).

## Этап 2 — План и реестр (завершен 2026-08-02)

Реестр создан в JSON рядом с этим журналом. Порядок публикации: сначала 4 срочные сезонные темы (1, 2, 6, 10 — фитофтора, стерилизация, чеснок, кабачки), затем 6 evergreen.

## КРИТИЧНАЯ ПОПРАВКА К ЭТАПУ 1 (обнаружено в процессе Этапа 3)

Первичный аудит (см. таблицу выше) шёл против EU Supabase-проекта `plwkjdpuxjkmpkqiqzkk` — эта база оказалась **ROLLBACK-ONLY снапшотом от ~2026-06-11** (см. bead `sovetydoma-58o`), а не продакшеном. Реальный продакшен — self-hosted Supabase на VPS `89.169.44.37`, доступ через SSH (`ssh -i ~/.ssh/timeweb_1001sovet root@89.169.44.37` → `docker exec -i supabase-db psql`) или через `https://api.1001sovet.ru` (тот же сервер, тот путь используют штатные скрипты `scripts/matrix/*.mjs`).

Перепроверка против реальной продакшн-базы показала: **5 из 10 тем уже были опубликованы ~7 недель назад (12.06.2026)**, а не находились в статусе idea. Решения NEW/UPDATE пересмотрены и зафиксированы в JSON-реестре (актуальны). Также найдена ранее неизвестная каннибализация по теме чеснока (bead `sovetydoma-9nb.2`).

**Вывод на будущее**: перед началом любой работы с `content_matrix` через Supabase MCP — сверяться с паспортным bead `sovetydoma-58o`, не доверять первому найденному проекту с похожим именем.

## Этап 3 — Подготовка статей (завершено 2026-08-02)

Все 10 статей написаны и приведены к единому редакционному стилю (см. ниже). Правки внесены как в сами статьи, так и в промпты для автономной генерации черновиков (`scripts/matrix/gen-drafts-kimi.mjs`, `scripts/matrix/gen-drafts-grok.mjs`) — чтобы будущие автономные батчи тоже следовали этому стилю, а не только эти 10 материалов.

**Правка стиля по запросу владельца (2026-08-02, во время сессии)**: каждая статья открывается тёплым приветствием и закрывается тёплым прощанием, ротация из 10 вариантов каждого (без повторов внутри этой десятки статей), более человечный бытовой тон вместо сухого/наукообразного.

| # | Тема | Решение | Статус |
|---|---|---|---|
| 1 | Фитофтора | UPDATE | live, content refresh |
| 2 | Стерилизация банок | UPDATE | live, расширен заголовок с "для огурцов" до общего |
| 3 | Стиральная машина не сливает | NEW | live, полный цикл через матрицу |
| 4 | Холодильник не морозит | NEW | live |
| 5 | Пищевая моль | UPDATE | live, content refresh |
| 6 | Хранение чеснока | UPDATE | live, добавлена таблица для квартиры |
| 7 | Вода под ящиками холодильника | NEW | live |
| 8 | Заморозка петрушки | UPDATE | live, расширено с 2 до 4 способов |
| 9 | Посудомойка белый налёт | NEW | live |
| 10 | Кабачки гниют на кусте | NEW | live |

## Этап 4 — Техническая проверка и публикация (завершено 2026-08-02)

Все 10 URL проверены: HTTP 200, self-referencing canonical, в `sitemap-dynamic.xml`, без noindex. Публикация — штатным no-redeploy путём (`publish-dynamic.mjs` для новых; прямой UPDATE `content_matrix.body_md` + `updated_at` для рефрешей уже живых статей — кэш рендер-воркера инвалидируется по TTL, до 5 минут). Полные записи — в JSON, поле `http_status`/`indexability`/`in_sitemap` на каждую статью.

Попутно исправлен реальный баг в пайплайне: `scripts/matrix/ingest-drafts-batch.mjs` был захардкожен на `C:/DEV/sovetydoma`, хотя чекаут этого окружения — на `D:\`. Приведено к `process.cwd()`, как в остальных скриптах матрицы.

## Этап 5 — Индексирование (частично завершено 2026-08-02)

**Yandex + Bing (через IndexNow)**: все 10 URL отправлены, `202 Accepted` по каждому батчу (для новых статей — автоматически из `publish-dynamic.mjs`; для рефрешей — вручную через `scripts/submit-indexnow.mjs`).

**Google Search Console**: **БЛОКЕР** — нет авторизованной сессии ни в песочном браузере, ни через claude-in-chrome (расширение не подключено в этой сессии). Вход в аккаунт запрещён политикой безопасности агента. Список URL для ручного «Запросить индексирование» через GSC UI владельцем:
- https://1001sovet.ru/dacha-i-ogorod/fitoftora-tomaty-profilaktika-obrabotka/
- https://1001sovet.ru/kulinaria/sterilizatsiya-banok-ogurtsy-dukhovka-par/
- https://1001sovet.ru/pokupki-i-tehnika/stiralnaya-mashina-ne-slivaet-vodu-proverka/
- https://1001sovet.ru/pokupki-i-tehnika/holodilnik-ne-holodit-chto-proverit/
- https://1001sovet.ru/dom-i-uborka/pishchevaya-mol-kukhnya/
- https://1001sovet.ru/dacha-i-ogorod/khranenie-chesnoka-sushka-pletyonki/
- https://1001sovet.ru/pokupki-i-tehnika/voda-pod-yashchikami-holodilnika-sliv/
- https://1001sovet.ru/kulinaria/zamorozka-petrushki-sokhr-arom/
- https://1001sovet.ru/pokupki-i-tehnika/posudomoika-belyy-nalet-prichiny/
- https://1001sovet.ru/dacha-i-ogorod/kabachki-gniyut-na-kuste-zavyazi-prichina/

## Этап 6 — Дистрибуция без полных дублей (черновики готовы, публикация НЕ выполнена)

Тизеры для Дзен/VK/Facebook по каждой статье — в `reports/seo-experiment-search-demand-2026-08-social-drafts.json`. Полный текст статьи нигде не дублируется — только тизер с УТП.

UTM-шаблон: `utm_source={dzen|vk|facebook}&utm_medium=social&utm_campaign=content_test_2026q3&utm_content=1001_{topic}_{creative}_{variant}`.

Группа A (анонс через 24–48ч после публикации, т.е. 2026-08-03/04): темы 1, 6, 3, 5, 7.
Группа B (анонс после первого 7-дневного среза, т.е. после 2026-08-09): темы 2, 10, 4, 8, 9.
Обе группы содержат смесь сезонных и evergreen тем.

**Публикация в соцсети НЕ выполнена** — нет доступа к кабинетам Дзен/VK/Facebook Studio из этой сессии (нет соответствующих коннекторов/аутентификации). Это готовая очередь, ждёт ручной публикации владельцем либо подключения нужных коннекторов.

## Этап 7 — Наблюдение (настроено 2026-08-02)

Контрольные срезы для ВСЕХ 10 статей унифицированы по дате вмешательства (2026-08-02, независимо от того NEW это или content refresh UPDATE):
- **+7д = 2026-08-09**
- **+14д = 2026-08-16**
- **+30д = 2026-09-01**
- **+60д = 2026-10-01**
- **+90д = 2026-10-31**

Созданы 5 автоматических scheduled-задач (Claude Code scheduled tasks), которые запустятся сами в эти даты и проведут проверку индексации/аналитики, заполнят `checkpoints` в JSON и обновят beads:
`seo-search-demand-2026-08-checkpoint` (d7), `seo-search-demand-2026-08-d14`, `seo-search-demand-2026-08-d30`, `seo-search-demand-2026-08-d60`, `seo-search-demand-2026-08-d90-final`.
Задачи выполняются только пока приложение Claude Code открыто; если закрыто на момент срабатывания — выполнятся при следующем запуске.

## Журнал сессии

- **2026-08-02** — Создана ветка, эпик `sovetydoma-9nb`, завершен первичный аудит (Этап 1), создан реестр (Этап 2).
- **2026-08-02** — Обнаружена ошибка аудита: первичная проверка шла против rollback-only копии БД, не продакшена. Аудит переделан против реального self-hosted Supabase (SSH). Решения NEW/UPDATE скорректированы.
- **2026-08-02** — По запросу владельца добавлен house-style (приветствия/прощания, человечный тон) — внесён в промпты автономной генерации, не только в эти 10 статей.
- **2026-08-02** — Обнаружен параллельный агент, работающий в той же рабочей директории (`D:\DEV\sovetydoma`), временами переключавший git HEAD и один раз уничтоживший часть незакоммиченных правок реестра (`git reset` со стороны другого агента). Продакшн-контент не пострадал (публикуется напрямую в БД по SSH, не зависит от git). Дальнейшая работа перенесена в изолированный git worktree (`.claude/worktrees/seo-experiment`, ветка `content/seo-search-demand-2026-08-wt`) по указанию владельца.
- **2026-08-02** — Все 10 статей опубликованы/обновлены в продакшене, проверены (HTTP 200), отправлены в IndexNow (Yandex+Bing, 202 Accepted на все 10). GSC-часть индексирования заблокирована отсутствием авторизованной сессии — см. Этап 5. Соцсети подготовлены как очередь, не опубликованы — см. Этап 6. Настроено 5 автоматических scheduled-задач для срезов 7/14/30/60/90 дней.
