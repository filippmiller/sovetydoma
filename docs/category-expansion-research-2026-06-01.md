# Category expansion research — 2026-06-01

Goal: expand `СоветыДома` beyond the current 6 sections without creating empty
SEO-thin category pages.

## Current live sections

- Кулинария
- Дом и уборка
- Дача и огород
- Лайфхаки
- Экономия
- Рыбалка

## Competitor patterns

- `1001sovet.com` presents a broad general-advice structure around home comfort,
  household knowledge, family relationships, health/wellbeing, beauty/self-care,
  work/study life hacks, and practical everyday recommendations.
- `Ogorod.ru` splits the dacha/garden world into narrower intent sections:
  garden work, beds/vegetables, flower beds, school/how-to materials, recipes,
  pests, plant care, and seasonal jobs.
- `7dach.ru` is built around dacha life: сад и огород, recipes/preparations,
  building/home topics, health, and practical community questions.
- `IVD.ru` separates interiors and home topics into construction/repair, dacha
  and garden, cleaning, storage systems, shopping/products, and design ideas.

## Recommended next sections

Add only when each section has at least 20-30 ready articles.

1. `zdorove` — Здоровье
   Practical non-medical wellbeing: sleep, posture, home safety, seasonal habits.
   Avoid diagnosis/treatment claims.

2. `krasota-i-uhod` — Красота и уход
   Hair, skin, clothes care, grooming, safe home routines.

3. `semya-i-deti` — Семья и дети
   Household organization with children, school prep, family routines.

4. `remont` — Ремонт
   Small repairs, materials, tools, mistakes, estimates.

5. `interer-i-hranenie` — Интерьер и хранение
   Storage systems, small apartments, furniture layout, cozy home.

6. `tehnika` — Техника
   Appliances, phones, chargers, maintenance, safe use.

7. `pokupki` — Покупки
   Choosing goods, avoiding bad purchases, comparisons, checklists.

8. `zagotovki` — Заготовки
   Seasonal preserves, freezing, drying, storage. Could be split from cooking
   once enough content exists.

9. `sad` — Сад
   Trees, shrubs, pruning, fruit/berry care. Split from current dacha section.

10. `tsvetnik` — Цветник
    Flowers, beds, bulbs, perennials, decorative plants.

11. `vrediteli-i-bolezni` — Вредители и болезни растений
    Focused garden problem solving. Strong search demand.

12. `avto` — Авто
    Car care, saving on fuel, seasonal prep, emergency kit.

## Implementation rule

Do not add these to `src/lib/categories.ts` until the content exists. Empty
sections should stay out of navigation. Use future Kimi batches to create
content first, then add each section with validator/import support.
