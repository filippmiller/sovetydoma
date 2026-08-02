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

## Этап 3 — Подготовка статей

_Статус обновляется по мере готовности черновиков._

## Этап 4 — Техническая проверка и публикация

_См. per-article записи в JSON: http_status, indexability, canonical, in_sitemap._

## Этап 5 — Индексирование

_См. per-article `yandex_submission` / `google_submission` в JSON._

## Этап 6 — Дистрибуция без полных дублей

UTM-шаблон: `utm_source={dzen|vk|facebook}&utm_medium=social&utm_campaign=content_test_2026q3&utm_content=1001_{topic}_{creative}_{variant}`.
Группа A (анонс через 24–48ч после публикации) / Группа B (анонс после первого 7-дневного среза) — распределение см. ниже, как только определены даты публикации.

## Этап 7 — Наблюдение

Контрольные срезы по каждой статье: +7д, +14д, +30д, +60д, +90д от даты публикации. Точные календарные даты фиксируются в JSON `checkpoints` сразу после публикации каждой статьи (публикации будут в разные дни, поэтому даты срезов у статей разные).

## Журнал сессии

- **2026-08-02** — Создана ветка, эпик `sovetydoma-9nb`, завершен аудит (Этап 1), создан реестр (Этап 2). Далее: подготовка 4 срочных черновиков.
