# Image Relevance Audit

Date: 2026-06-06

Scope: visual relevance spot-audit for `kulinaria` article hero images after the live mismatch found on `/kulinaria/sous-dlya-grechki/`.

## Fixed now

- `sous-dlya-grechki`
  - Problem: old hero image showed pasta with cheese, not buckwheat or sauce.
  - Fix: replaced `public/images/sous-dlya-grechki.jpg` with a relevant generated food image: buckwheat kasha with creamy mushroom sauce.

## High-priority suspected mismatches

These need replacement or manual acceptance before large-scale publishing/social posting:

- `domashniy-mayonez-bystro` — image shows a branded Hellmann's bottle, contradicts "домашний майонез".
- `domashniy-tvorog-iz-moloka` — image reads like scrambled eggs/omelet, not homemade cottage cheese.
- `rassypchaty-ris` — image shows plated fish/potatoes, not loose rice.
- `kartoshka-v-duhovke` — image is too generic and does not clearly show baked potatoes.
- `domashniy-kvas-bez-lishney-sladosti` — image is a generic kitchen/table scene; kvas is not a clear subject.
- `kuriny-bulon` — image is a generic table scene; broth is not visible enough.
- `marinad-dlya-shashlyka` and `marinovannyy-luk` — images are generic plated food scenes, not marinade/onion process shots.

## Medium-priority review

- Several generated kitchen still lifes are visually pleasant but too generic for recipe pages. They are acceptable as temporary placeholders, but weak for SEO/social cards because the main object is not immediately identifiable.
- Some older real photos are low-resolution or awkwardly cropped but still semantically relevant. Those are lower priority than object-level mismatches.

## Recommended next pass

1. Replace the high-priority list above with specific generated or owned images.
2. Add a visual QA gate for future batches: every article marked `image_ready` must pass a title/image object check before publish.
3. For recipes, require the hero image to show the exact dish or ingredient named in the H1, not a generic kitchen or adjacent dish.
