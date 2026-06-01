# Kimi — next 50-article batch for СоветыДома

Use this prompt for the next controlled batch. It follows the existing article
factory, writes into `incoming-articles/`, and lets Codex run the importer,
validator, build, image pass, commit, push, deploy, and live verification.

Current content balance before this batch: 180 articles total:

- `dacha-i-ogorod`: 62
- `kulinaria`: 38
- `dom-i-uborka`: 35
- `layfkhaki`: 24
- `ekonomiya`: 20
- `rybalka`: 1

This batch intentionally adds many fishing articles because `rybalka` is almost
empty.

---

## Prompt For Kimi

````
Ты — редактор русского сайта бытовых советов «СоветыДома».

ЗАДАЧА: написать ровно 50 НОВЫХ статей в формате MDX для репозитория
C:\DEV\sovetydoma.

ПИШИ ФАЙЛЫ СЮДА:
incoming-articles/<slug>.mdx

Не пиши в src/content/articles напрямую. После твоей работы Codex запустит:
node scripts/import-articles.mjs --dry
node scripts/import-articles.mjs
pnpm run build

== КАТЕГОРИИ (только эти 6) ==
kulinaria       -> Кулинария
dom-i-uborka    -> Дом и уборка
dacha-i-ogorod  -> Дача и огород
layfkhaki       -> Лайфхаки
ekonomiya       -> Экономия
rybalka         -> Рыбалка

== ОБЩИЕ ПРАВИЛА ==
- Ровно 50 файлов .mdx, по одному файлу на тему из списка ниже.
- Имя файла = <slug>.mdx.
- Поле slug во фронтматтере = тот же slug.
- Не меняй slug из списка.
- Не дублируй темы и не переписывай существующие статьи.
- Никаких упоминаний ИИ, нейросетей, автоматической генерации, виртуальных редакторов.
- Текст должен выглядеть как практическая редакционная статья от живого автора.
- Пиши по-русски, без английских слов в тексте и заголовках, кроме slug во фронтматтере.
- Не вставляй изображения в тело статьи.
- Не добавляй шаблонный раздел "Заключение".
- Не используй медицинские, юридические или опасные советы без осторожных оговорок.

== ФРОНТМАТТЕР КАЖДОГО ФАЙЛА ==
Между --- и ---:

title: "..."          (40-70 символов, по-русски, конкретный и полезный)
slug: "..."           (строго slug из списка)
category: "..."       (строго category из списка)
categoryName: "..."   (строго по таблице категорий)
description: "..."    (1 предложение, до 160 символов, SEO-описание)
date: "2026-06-01"
image: "/images/<slug>.jpg"
tags: ["...","...","...","..."]   (4-6 тегов по-русски)

Для рецептов category: kulinaria добавь:
schemaType: "Recipe"
prepTime: "PT20M"
cookTime: "PT40M"
recipeYield: "4 порции"
difficulty: "Легко"   (Легко | Средне | Сложно)
recipeIngredient:
  - "ингредиент с количеством"
  - "..."

== ТЕЛО СТАТЬИ ==
После второго ---:
- вступление 2-3 предложения без заголовка;
- 5-8 разделов, каждый начинается с "## Заголовок";
- 700-1200 слов;
- конкретика: числа, сроки, пропорции, температуры, размеры, сезонность, частые ошибки;
- списки через "- пункт";
- **жирный** только для реально важных предупреждений и норм;
- стиль спокойный, практичный, без рекламной воды.

== ПРОВЕРКА ПОСЛЕ ЗАПИСИ ==
После создания всех 50 файлов проверь, что:
- в incoming-articles/ ровно 50 новых .mdx;
- каждый файл имеет обязательные поля frontmatter;
- categoryName точно соответствует category;
- image всегда равен "/images/<slug>.jpg";
- нет кириллицы в slug;
- нет повторов slug;
- статьи про рыбалку имеют реальные сезонные и снастевые детали, а не общие фразы.

== СПИСОК 50 ТЕМ ==

1. ТЕМА: Как выбрать спиннинг для начинающего рыбака | SLUG: vybor-spinninga-dlya-nachinayushchih | КАТЕГОРИЯ: rybalka
2. ТЕМА: Ловля щуки на спиннинг осенью: приманки и проводка | SLUG: lovlya-shchuki-osenyu | КАТЕГОРИЯ: rybalka
3. ТЕМА: Как ловить карася на поплавочную удочку летом | SLUG: lovlya-karasya-letom | КАТЕГОРИЯ: rybalka
4. ТЕМА: Прикормка для леща своими руками: состав и пропорции | SLUG: prikormka-dlya-leshcha | КАТЕГОРИЯ: rybalka
5. ТЕМА: Как выбрать леску для поплавочной удочки | SLUG: vybor-leski-dlya-udochki | КАТЕГОРИЯ: rybalka
6. ТЕМА: Лучшие узлы для рыбалки: как вязать без обрывов | SLUG: rybolovnye-uzly | КАТЕГОРИЯ: rybalka
7. ТЕМА: Ловля окуня на микроджиг: снасти и ошибки | SLUG: lovlya-okunya-na-mikrodzhig | КАТЕГОРИЯ: rybalka
8. ТЕМА: Как хранить рыболовные снасти дома и в машине | SLUG: hranenie-rybolovnyh-snastey | КАТЕГОРИЯ: rybalka
9. ТЕМА: Фидерная ловля для новичков: кормушка, поводок, монтаж | SLUG: fidernaya-lovlya-dlya-novichkov | КАТЕГОРИЯ: rybalka
10. ТЕМА: Как выбрать катушку для спиннинга без переплаты | SLUG: vybor-katushki-dlya-spinninga | КАТЕГОРИЯ: rybalka
11. ТЕМА: Ловля карпа на пруду: место, прикормка и насадка | SLUG: lovlya-karpa-na-prudu | КАТЕГОРИЯ: rybalka
12. ТЕМА: Как подготовить рыболовный ящик к сезону | SLUG: rybolovnyy-yashchik-k-sezonu | КАТЕГОРИЯ: rybalka
13. ТЕМА: Зимняя ловля окуня на мормышку: что работает | SLUG: zimnyaya-lovlya-okunya | КАТЕГОРИЯ: rybalka
14. ТЕМА: Как выбрать бур для зимней рыбалки | SLUG: vybor-bura-dlya-zimney-rybalki | КАТЕГОРИЯ: rybalka
15. ТЕМА: Безопасность на льду: правила для зимней рыбалки | SLUG: bezopasnost-na-ldu-rybalka | КАТЕГОРИЯ: rybalka
16. ТЕМА: Ловля судака на джиг: глубина, приманки, проводка | SLUG: lovlya-sudaka-na-dzhig | КАТЕГОРИЯ: rybalka
17. ТЕМА: Как подобрать крючок под наживку и размер рыбы | SLUG: vybor-kryuchka-dlya-rybalki | КАТЕГОРИЯ: rybalka
18. ТЕМА: Донная снасть своими руками: простой рабочий монтаж | SLUG: donnaya-snast-svoimi-rukami | КАТЕГОРИЯ: rybalka
19. ТЕМА: Ловля плотвы весной: где искать и чем кормить | SLUG: lovlya-plotvy-vesnoy | КАТЕГОРИЯ: rybalka
20. ТЕМА: Как сохранить рыбу свежей после улова в жару | SLUG: kak-sohranit-rybu-svezhey | КАТЕГОРИЯ: rybalka
21. ТЕМА: Рыбалка в дождь: когда клев улучшается, а когда нет | SLUG: rybalka-v-dozhd | КАТЕГОРИЯ: rybalka
22. ТЕМА: Как выбрать рыболовные сапоги и забродники | SLUG: vybor-sapog-dlya-rybalki | КАТЕГОРИЯ: rybalka
23. ТЕМА: Ловля налима осенью: время, снасти и наживка | SLUG: lovlya-nalima-osenyu | КАТЕГОРИЯ: rybalka
24. ТЕМА: Как не запутывать снасти при перевозке | SLUG: kak-ne-zaputyvat-snasti | КАТЕГОРИЯ: rybalka
25. ТЕМА: Рыбалка с берега на малой реке: как выбрать место | SLUG: rybalka-s-berega-na-maloy-reke | КАТЕГОРИЯ: rybalka
26. ТЕМА: Как чистить и обслуживать катушку после рыбалки | SLUG: obsluzhivanie-rybolovnoy-katushki | КАТЕГОРИЯ: rybalka
27. ТЕМА: Ловля голавля летом: приманки и осторожная подача | SLUG: lovlya-golavlya-letom | КАТЕГОРИЯ: rybalka
28. ТЕМА: Как выбрать эхолот для любительской рыбалки | SLUG: vybor-eholota-dlya-rybalki | КАТЕГОРИЯ: rybalka
29. ТЕМА: Рыбалка с детьми: что взять и как не испортить день | SLUG: rybalka-s-detmi | КАТЕГОРИЯ: rybalka
30. ТЕМА: Как солить и вялить рыбу дома безопасно | SLUG: kak-solit-i-vyalit-rybu | КАТЕГОРИЯ: rybalka

31. ТЕМА: Как снизить расходы на продукты летом без жесткой экономии | SLUG: ekonomiya-na-produktah-letom | КАТЕГОРИЯ: ekonomiya
32. ТЕМА: Как покупать бытовую химию выгодно и не брать лишнее | SLUG: ekonomiya-na-bytovoy-himii | КАТЕГОРИЯ: ekonomiya
33. ТЕМА: Как составить недельное меню и меньше выбрасывать еды | SLUG: nedelnoe-menyu-bez-othodov | КАТЕГОРИЯ: ekonomiya
34. ТЕМА: Как экономить на даче: вода, свет, рассада и инвентарь | SLUG: ekonomiya-na-dache | КАТЕГОРИЯ: ekonomiya
35. ТЕМА: Как проверить скидку в магазине и не попасться на уловки | SLUG: proverka-skidok-v-magazine | КАТЕГОРИЯ: ekonomiya

36. ТЕМА: Как быстро собрать тревожную домашнюю аптечку без лишнего | SLUG: domashnyaya-aptechka-bez-lishnego | КАТЕГОРИЯ: layfkhaki
37. ТЕМА: Как подписать провода и зарядки, чтобы не путаться | SLUG: markirovka-provodov-i-zaryadok | КАТЕГОРИЯ: layfkhaki
38. ТЕМА: Как собрать дорожную сумку за 20 минут и ничего не забыть | SLUG: dorozhnaya-sumka-za-20-minut | КАТЕГОРИЯ: layfkhaki
39. ТЕМА: Как убрать запах в термосе и бутылке без агрессивной химии | SLUG: zapah-v-termose-i-butylke | КАТЕГОРИЯ: layfkhaki
40. ТЕМА: Как быстро охладить квартиру вечером без кондиционера | SLUG: ohladit-kvartiru-bez-konditsionera | КАТЕГОРИЯ: layfkhaki

41. ТЕМА: Как отмыть москитные сетки и не порвать их | SLUG: kak-otmyt-moskitnye-setki | КАТЕГОРИЯ: dom-i-uborka
42. ТЕМА: Как убрать шерсть с дивана, ковра и одежды | SLUG: ubrat-sherst-s-divana-i-kovra | КАТЕГОРИЯ: dom-i-uborka
43. ТЕМА: Как почистить вытяжку на кухне от липкого жира | SLUG: pochistit-kuhonnuyu-vytyazhku | КАТЕГОРИЯ: dom-i-uborka
44. ТЕМА: Как организовать хранение круп, муки и специй | SLUG: hranenie-krup-muki-spetsiy | КАТЕГОРИЯ: dom-i-uborka
45. ТЕМА: Как освежить шторы без полной стирки | SLUG: osvezhit-shtory-bez-stirki | КАТЕГОРИЯ: dom-i-uborka

46. ТЕМА: Малосольные огурцы в пакете за ночь | SLUG: malosolnye-ogurtsy-v-pakete | КАТЕГОРИЯ: kulinaria
47. ТЕМА: Домашний квас без лишней сладости | SLUG: domashniy-kvas-bez-lishney-sladosti | КАТЕГОРИЯ: kulinaria
48. ТЕМА: Как приготовить уху из речной рыбы без запаха тины | SLUG: uha-iz-rechnoy-ryby | КАТЕГОРИЯ: kulinaria

49. ТЕМА: Как защитить клубнику от птиц без вреда для участка | SLUG: zashchita-klubniki-ot-ptits | КАТЕГОРИЯ: dacha-i-ogorod
50. ТЕМА: Как поливать теплицу в жару, чтобы растения не болели | SLUG: poliv-teplitsy-v-zharu | КАТЕГОРИЯ: dacha-i-ogorod

Начинай сразу. После завершения выведи краткий отчет:
- сколько файлов создано;
- сколько статей в каждой категории;
- список slug;
- были ли проблемы с форматом.
````

---

## Codex Import After Kimi

```bash
cd C:\DEV\sovetydoma
node scripts/import-articles.mjs --dry
node scripts/import-articles.mjs
pnpm run build
pnpm run audit:seo
git status --short
```

If the import/build is clean, generate or fetch images for the new slugs, run the
image audit, then commit and push.
