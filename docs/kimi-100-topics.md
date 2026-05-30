# Kimi — 100-article batch prompt for СоветыДома

Paste the **MASTER PROMPT** into Kimi once, then feed it topics from the
**TOPIC LIST** (one at a time, or in small batches). Save each output into
`incoming-articles/`, then run `node scripts/import-articles.mjs`.

The suggested `slug` is given for each topic so Kimi can't get it wrong.

---

## MASTER PROMPT

````
Ты — редактор русского сайта бытовых советов «СоветыДома». Я буду давать тебе
ТЕМУ и SLUG. На каждую тему ты пишешь ОДНУ статью строго в формате MDX-файла.
Выводи ТОЛЬКО содержимое файла, без пояснений и без обёртки ```.

ФРОНТМАТТЕР между --- и ---:
  title: "..."          (40–70 символов, цепляющий, по-русски)
  slug: "..."           (Я даю готовый slug — используй его БЕЗ изменений)
  category: "..."       (Я даю категорию — одно из: kulinaria, dom-i-uborka,
                         dacha-i-ogorod, layfkhaki, ekonomiya)
  categoryName: "..."   (СТРОГО: kulinaria→Кулинария, dom-i-uborka→Дом и уборка,
                         dacha-i-ogorod→Дача и огород, layfkhaki→Лайфхаки,
                         ekonomiya→Экономия)
  description: "..."    (1 предложение, до 160 символов, для SEO)
  date: "2026-05-31"
  image: "/images/<slug>.jpg"
  tags: ["...","...","..."]   (4–6 тегов по-русски)

Для рецептов (category: kulinaria) добавь в фронтматтер:
  schemaType: "Recipe"
  prepTime: "PT20M"     (ISO 8601)
  cookTime: "PT40M"
  recipeYield: "4 порции"
  difficulty: "Легко"   (Легко | Средне | Сложно)
  recipeIngredient:
    - "ингредиент с количеством"
    - "..."

ТЕЛО (после второго ---):
  - короткое вступление 2–3 предложения, БЕЗ заголовка
  - 5–8 разделов, каждый начинается с "## Заголовок раздела"
  - 700–1200 слов, практично и по делу, без воды и общих фраз
  - используй списки (- пункт) и **жирный** для ключевых моментов
  - конкретные числа, сроки, пропорции, температуры — где уместно
  - НЕ вставляй изображения, НЕ пиши шаблонное «Заключение»
  - НИКАКИХ английских слов в заголовках/тексте (slug — исключение)
  - НЕ упоминай, что текст написан ИИ

Когда я пришлю «ТЕМА: ... | SLUG: ... | КАТЕГОРИЯ: ...», ответь только готовым
MDX-файлом. Подтверди, что понял формат.
````

После подтверждения отправляй Kimi темы построчно из списка ниже в виде:
`ТЕМА: <название> | SLUG: <slug> | КАТЕГОРИЯ: <category>`

---

## TOPIC LIST (100)

### Кулинария — kulinaria (25)
1. Домашний хлеб в духовке для начинающих | hleb-v-duhovke | kulinaria
2. Как сварить рассыпчатый рис без слипания | rassypchatyy-ris | kulinaria
3. Сочные котлеты: секреты фарша и обжарки | sochnye-kotlety | kulinaria
4. Блины тонкие на молоке без комков | bliny-na-moloke | kulinaria
5. Как пожарить идеальную яичницу и омлет | yaichnitsa-omlet | kulinaria
6. Тушёная капуста как в столовой | tushenaya-kapusta | kulinaria
7. Плов из свинины в казане | plov-iz-svininy | kulinaria
8. Сырники из творога пышные и не разваливаются | syrniki-iz-tvoroga | kulinaria
9. Домашний майонез за 2 минуты | domashniy-mayonez-bystro | kulinaria
10. Как замариновать шашлык, чтобы был мягким | marinad-dlya-shashlyka | kulinaria
11. Гречка с мясом по-купечески | grechka-po-kupecheski | kulinaria
12. Запечённая курица с хрустящей корочкой | zapechennaya-kuritsa | kulinaria
13. Оладьи на кефире пышные | oladi-na-kefire | kulinaria
14. Домашние пельмени: тесто и лепка | domashnie-pelmeni-testo | kulinaria
15. Солянка мясная сборная классическая | solyanka-sbornaya-myasnaya | kulinaria
16. Картофельное пюре без комочков | kartofelnoe-pyure | kulinaria
17. Шарлотка с яблоками простая | sharlotka-s-yablokami | kulinaria
18. Как сварить вкусный компот из сухофруктов | kompot-iz-suhofruktov | kulinaria
19. Гуляш из говядины с подливой | gulyash-iz-govyadiny | kulinaria
20. Запеканка творожная как в детском саду | tvorozhnaya-zapekanka | kulinaria
21. Тесто для пиццы тонкое и хрустящее | testo-dlya-pitstsy | kulinaria
22. Маринованный лук к шашлыку и салатам | marinovannyy-luk | kulinaria
23. Как правильно варить макароны аль денте | kak-varit-makarony | kulinaria
24. Печенье овсяное домашнее | ovsyanoe-pechenie | kulinaria
25. Соусы к мясу: 5 простых рецептов | sousy-k-myasu | kulinaria

### Дом и уборка — dom-i-uborka (25)
26. Как отмыть духовку от жира без химии | otmyt-duhovku-ot-zhira | dom-i-uborka
27. Чистка стиральной машины от запаха | chistka-stiralnoy-mashiny | dom-i-uborka
28. Как удалить накипь в чайнике лимонной кислотой | udalit-nakip-limonkoy | dom-i-uborka
29. Уборка холодильника и устранение запаха | uborka-holodilnika | dom-i-uborka
30. Как отмыть пригоревшую кастрюлю | prigorevshaya-kastryulya | dom-i-uborka
31. Чистка ковра в домашних условиях | chistka-kovra-doma | dom-i-uborka
32. Как помыть окна без разводов | pomyt-okna-bez-razvodov | dom-i-uborka
33. Удаление плесени в ванной | plesen-v-vannoy | dom-i-uborka
34. Как почистить утюг от нагара | pochistit-utyug | dom-i-uborka
35. Чистка микроволновки паром | chistka-mikrovolnovki | dom-i-uborka
36. Как отмыть жалюзи быстро | otmyt-zhalyuzi | dom-i-uborka
37. Уход за деревянной мебелью | uhod-za-mebelyu | dom-i-uborka
38. Как уменьшить количество пыли в квартире | menshe-pyli-v-kvartire | dom-i-uborka
39. Чистка швов между плиткой | shvy-mezhdu-plitkoy | dom-i-uborka
40. Как вывести запах из обуви | zapah-iz-obuvi | dom-i-uborka
41. Стирка пуховика в стиральной машине | stirka-puhovika | dom-i-uborka
42. Как почистить серебро и золото дома | pochistit-serebro | dom-i-uborka
43. Уборка после ремонта: с чего начать | uborka-posle-remonta | dom-i-uborka
44. Как отмыть зеркало до блеска | otmyt-zerkalo | dom-i-uborka
45. Организация хранения на маленькой кухне | hranenie-na-kuhne | dom-i-uborka
46. Как почистить диван от пятен | pochistit-divan | dom-i-uborka
47. Удаление жвачки с одежды и мебели | udalit-zhvachku | dom-i-uborka
48. Как отстирать кухонные полотенца | otstirat-polotentsa | dom-i-uborka
49. Порядок в шкафу: система складывания | poryadok-v-shkafu | dom-i-uborka
50. Как избавиться от запаха в посудомойке | zapah-v-posudomoyke | dom-i-uborka

### Дача и огород — dacha-i-ogorod (25)
51. Когда и как сажать чеснок под зиму | posadka-chesnoka-pod-zimu | dacha-i-ogorod
52. Выращивание рассады томатов дома | rassada-tomatov | dacha-i-ogorod
53. Как бороться с тлёй на растениях | borba-s-tley | dacha-i-ogorod
54. Подкормка огурцов для большого урожая | podkormka-ogurtsov | dacha-i-ogorod
55. Обрезка яблони весной | obrezka-yabloni | dacha-i-ogorod
56. Как сохранить морковь на зиму | hranenie-morkovi | dacha-i-ogorod
57. Посадка картофеля: сроки и схема | posadka-kartofelya | dacha-i-ogorod
58. Компост своими руками быстро | kompost-svoimi-rukami | dacha-i-ogorod
59. Как избавиться от муравьёв на участке | muravi-na-uchastke | dacha-i-ogorod
60. Выращивание клубники в открытом грунте | klubnika-v-grunte | dacha-i-ogorod
61. Чем подкормить помидоры в теплице | podkormka-pomidorov-teplitsa | dacha-i-ogorod
62. Как бороться с колорадским жуком | koloradskiy-zhuk | dacha-i-ogorod
63. Полив огорода: сколько и как часто | poliv-ogoroda | dacha-i-ogorod
64. Подготовка грядок к зиме | gryadki-k-zime | dacha-i-ogorod
65. Выращивание зелени на подоконнике | zelen-na-podokonnike | dacha-i-ogorod
66. Как избавиться от слизней | borba-so-slizniami | dacha-i-ogorod
67. Посадка лука на репку | posadka-luka | dacha-i-ogorod
68. Сидераты для улучшения почвы | sideraty | dacha-i-ogorod
69. Уход за смородиной для урожая | uhod-za-smorodinoy | dacha-i-ogorod
70. Как укрыть розы на зиму | ukryt-rozy-na-zimu | dacha-i-ogorod
71. Выращивание кабачков в открытом грунте | vyrashchivanie-kabachkov | dacha-i-ogorod
72. Болезни огурцов и их лечение | bolezni-ogurtsov | dacha-i-ogorod
73. Как сделать тёплую грядку | teplaya-gryadka | dacha-i-ogorod
74. Прививка плодовых деревьев для новичков | privivka-derevev | dacha-i-ogorod
75. Что посадить в тени на даче | rasteniya-dlya-teni | dacha-i-ogorod

### Лайфхаки — layfkhaki (13)
76. Как развязать тугой узел и пакеты | razvyazat-uzel | layfkhaki
77. Лайфхаки для зарядки телефона | zaryadka-telefona-layfhaki | layfkhaki
78. Как открыть банку с тугой крышкой | otkryt-tuguyu-kryshku | layfkhaki
79. Что делать, если сел телефон в дороге | sel-telefon | layfkhaki
80. Как быстро охладить напиток | ohladit-napitok-bystro | layfkhaki
81. Лайфхаки для уборки за 15 минут | bystraya-uborka-15-minut | layfkhaki
82. Как починить молнию на куртке | pochinit-molniyu | layfkhaki
83. Способы убрать царапины с мебели | tsarapiny-na-mebeli | layfkhaki
84. Как заточить нож без точилки | zatochit-nozh | layfkhaki
85. Лайфхаки хранения проводов и зарядок | hranenie-provodov | layfkhaki
86. Как высушить обувь быстро и без запаха | vysushit-obuv | layfkhaki
87. Полезные применения соды в быту | soda-v-bytu | layfkhaki
88. Как избавиться от статического электричества на одежде | staticheskoe-elektrichestvo | layfkhaki

### Экономия — ekonomiya (12)
89. Как экономить на продуктах без потери качества | ekonomiya-na-produktah | ekonomiya
90. Снижение счетов за электричество | ekonomiya-elektrichestva | ekonomiya
91. Как экономить воду в квартире | ekonomiya-vody | ekonomiya
92. Планирование семейного бюджета | semeynyy-byudzhet | ekonomiya
93. Как покупать одежду выгодно | ekonomiya-na-odezhde | ekonomiya
94. Кэшбэк и бонусные программы: как использовать | keshbek-bonusy | ekonomiya
95. Как экономить на отоплении зимой | ekonomiya-na-otoplenii | ekonomiya
96. Список покупок, который экономит деньги | spisok-pokupok | ekonomiya
97. Как сократить расходы на бензин | ekonomiya-benzina | ekonomiya
98. Дешёвые и полезные продукты для рациона | deshevye-produkty | ekonomiya
99. Как экономить на бытовой химии | ekonomiya-na-himii | ekonomiya
100. Подготовка к отпуску без лишних трат | ekonomnyy-otpusk | ekonomiya

---

## After Kimi writes them

```bash
# drop all .mdx into incoming-articles/, then:
node scripts/import-articles.mjs --dry     # validate the whole batch
node scripts/import-articles.mjs           # copy valid ones into the site
git add src/content/articles && git commit -m "content: 100 articles" && git push
```
