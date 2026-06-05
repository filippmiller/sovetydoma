# Auth Audit: Registration & Login — 1001sovet.ru (Full Report)

**Date:** 2026-06-06  
**Auditor:** Grok 4.3  
**Scope:** Production site https://1001sovet.ru — full product, UX, technical, security audit of auth flows (registration, login, password recovery, integration with favorites/comments/profile).  
**References:** 
- Previous partial work: `reports/auth-email-confirmation-root-cause.md` (2026-06-01)
- E2E artifacts: `reports/e2e/auth-email-confirmation-20260604075626.json` (successful delivery test on 2026-06-04 from maryana.sidorova@1001sovet.ru)
- Beads: sovetydoma-aau (this audit), plus related RLS/auth sync beads (39y, gx3, xoq, clq)

**Important constraints respected:** No production breakage, no user deletion, no password changes, no secrets published, no live test users created in this session.

---

## 1. Short Prompt for Codex / Implementation Agent (copy-paste ready)

```
Ты — опытный full-stack инженер. Прочитай полностью файл reports/auth-audit-registration-login-2026-06.md.

Задача: привести регистрацию, логин и восстановление пароля на 1001sovet.ru в production-ready состояние по приоритетам P0 → P3.

Правила:
- Работай только через beads (bd create / update / close). Создай эпик + задачи под P0/P1.
- Не ломай prod, не удаляй пользователей, не меняй реальные пароли.
- Если нужно тестовые аккаунты — создавай с префиксом qa-test-delete-after- и явно фиксируй в test-accounts-and-seed-data.md что удалить.
- Сначала почини P0: 1) полноценный forgot/reset password flow, 2) надёжную доставку писем + диагностику.
- Добавь show/hide password, confirm password, чекбокс согласия, сильные требования к паролю.
- Улучши ошибки (все на русском, без сырых Supabase сообщений, без enumeration).
- Сделай единый хороший PasswordInput компонент.
- Проверь/почини создание профиля при регистрации (trigger или надёжный insert).
- Добавь Turnstile на auth-формы.
- Обнови Supabase SMTP/DKIM/DMARC если нужно (координируй с владельцем).
- Добавь тесты (хотя бы базовые E2E сценарии) и улучши мониторинг.
- В конце обнови HANDOFF и закрой бид.

Начинай с P0. После каждого значимого шага — коммит + обновление beads.
Сначала сделай план в комментарии к беду, потом реализуй.
```

---

## 2. Executive Summary (Кратко и жёстко)

Текущая auth-система — сырой MVP. Она "работает" для счастливого пути, но:

- **P0**: Нет восстановления пароля вообще. Пользователи, забывшие пароль, теряют аккаунт навсегда.
- **P0**: Доставка писем ненадёжна (пользователь пожаловался, были rate limit'ы, хотя в одном тесте июня письмо пришло).
- **P1**: Нет show/hide пароля в пользовательском модале, нет confirm password, нет согласия с условиями.
- **P1**: Слабая обработка ошибок, возможна enumeration, отсутствует профиль при регистрации в некоторых случаях.
- **Много P2/P3**: UX, a11y, mobile, copy, безопасность клиента, отсутствие тестов.

Архитектура: чистый клиентский Supabase Auth + static export. Вся логика в `src/components/auth/AuthModal.tsx` + `AuthButton.tsx`.

Email: custom template + Mailcow (`maryana.sidorova@1001sovet.ru` в успешном тесте). DNS: SPF ок, DMARC p=none, DKIM не подтверждён на проверенных селекторах.

**Цель аудита выполнена**: не просто баги, а конкретный план, как сделать лучшую регистрацию/логин для сайта советов.

---

## 3. P0 — Блокирует регистрацию/логин

### P0-1. Полностью отсутствует forgot password / recovery flow
- **Files**: `src/components/auth/AuthModal.tsx` (нет ни одного упоминания reset), `AuthButton.tsx`, весь сайт.
- **Evidence**: Grep по resetPasswordForEmail / forgot / recovery / reset — 0 релевантных вызовов.
- **Impact**: Любой пользователь, забывший пароль, не может войти. Критично для retention.
- **Recommended**: Полноценный flow (модал или /reset) + `supabase.auth.resetPasswordForEmail` + страница/модал установки нового пароля с confirm.
- **Also**: Добавить recovery email template в Supabase Dashboard.

### P0-2. Регистрация не гарантирует доставку письма (и нет диагностики)
- **Files**: `AuthModal.tsx:75-88` (signUp), `90-109` (resend), `getAuthRedirectTo:383`.
- **Evidence**: Жалоба пользователя + предыдущий отчёт `auth-email-confirmation-root-cause.md` (rate limit, письма не приходили) + успешный тест 04.06 только после ручной работы.
- **Root causes**:
  - Возможно использование дефолтного отправителя Supabase (низкие лимиты).
  - SMTP настроен, но нестабильно (или был).
  - DNS: DMARC p=none, DKIM не найден на дефолтных селекторах.
- **Recommended**:
  - Подтвердить/зафиксировать SMTP в дашборде Supabase (Mailcow, from: @1001sovet.ru).
  - Добавить DKIM.
  - Поднять DMARC до quarantine после мониторинга.
  - В UI: показывать "Письмо отправлено. Не пришло? Проверьте спам и нажмите Resend" + cooldown.
  - Добавить тестовый QA-аккаунт с явной пометкой на удаление.

---

## 4. P1 — Major broken flows

### P1-1. Нет show/hide password в пользовательском модале
- Только в `src/components/admin/AdminLoginForm.tsx` есть.
- **Fix**: Сделать общий `<PasswordInput>` компонент.

### P1-2. Нет confirm password + слишком слабые требования (min 6)
- `AuthModal.tsx:354` — только HTML minLength=6.
- Принимает "123456", "password" и т.д.

### P1-3. Нет согласия с условиями и политикой при регистрации
- Юридический риск (комментарии, профили, сохранёнки — персональные данные).

### P1-4. Profile не всегда создаётся при регистрации
- Нет `profiles.insert` после signUp.
- `.single()` в `moy-kabinet/page.tsx:49` и AuthButton без надёжного fallback.
- Триггер не виден в версионированных миграциях (см. bead 39y).

### P1-5. Слабая защита от brute-force / enumeration / отсутствие rate-limit на клиенте
- Нет Turnstile на auth (есть только на подписках).
- Ошибки иногда раскрывают существование аккаунта.

### P1-6. RLS и UGC таблицы не версионированы
- (Уже есть отдельные beads).

---

## 5. P2 / P3 (сводка)

**P2**:
- Нет cooldown на resend в UI.
- Нет способа исправить email после регистрации до подтверждения.
- Модал: нет полноценного focus trap, не `<dialog>`, слабый a11y.
- После login/logout — полный `window.location.reload()`.
- Favorites: неидеальный sync localStorage → DB после логина.
- Нет тестов auth.
- Mobile и keyboard handling не проверены системно.

**P3**:
- Кнопки "Продолжить" для обоих табов.
- Устаревший social proof "500+".
- Сырой copy в некоторых местах.
- Emoji-иконки в инпутах.

---

## 6. A. Ideal Auth UX Specification (целевое состояние)

**Entry points**: Header (Войти / аватар-дропдаун) + из действий (избранное, комментарий, написать) с reason в модале.

**Модал**:
- Табы Войти / Зарегистрироваться.
- Register: Имя + Email + Пароль + Подтвердите пароль + Чекбокс согласия (с ссылками) + (Turnstile).
- Показывать требования к паролю.
- Show/hide везде.
- После регистрации — состояние "Проверьте почту" внутри модала с resend + "Я ошибся в адресе".

**Forgot/Reset**:
- Ссылка из логина → ввести email → "Письмо отправлено".
- Переход по ссылке → форма нового пароля (с confirm + показ требований) → успех → "Пароль изменён. Войдите".

**После действий**:
- Login success → reload или мягкий refresh + продолжение действия.
- Logout чистит состояние.

**Mobile / A11y / States**: Полноценный dialog, focus trap, хорошие aria, loading, error, success states. Все тексты на русском, доверительные и понятные.

---

## 7. B. Technical Implementation Plan (конкретно)

**Supabase / Email**:
- Зафиксировать SMTP + from в дашборде.
- Добавить recovery template.
- DKIM + поднять DMARC.
- Проверить/поднять rate limits.

**Код**:
- Создать `PasswordInput.tsx` (show/hide + autocomplete правильно).
- Полностью переработать `AuthModal.tsx` (добавить forgot subflow, confirm pass, terms, cooldown, лучшую обработку ошибок).
- Добавить Turnstile на формы.
- Починить/добавить создание профиля (миграция trigger предпочтительна).
- Улучшить `moy-kabinet`, `AuthButton` (maybeSingle + fallback).
- Добавить явную обработку auth callback при переходе по ссылкам из писем (если нужно).

**Другое**:
- Версионировать RLS + триггеры (отдельный бид).
- Добавить базовые E2E тесты на auth.
- Добавить логирование/мониторинг auth событий.
- Обновить `test-accounts-and-seed-data.md` при создании QA.

---

## 8. C. Production-Ready Checklist

- [ ] Registration + подтверждение по email работает стабильно
- [ ] Forgot password полный цикл работает
- [ ] Show/hide + confirm password + сила пароля
- [ ] Чекбокс согласия + ссылки на политику
- [ ] Хорошие русские ошибки без enumeration
- [ ] Resend с cooldown
- [ ] Turnstile / rate limit
- [ ] Profile создаётся надёжно
- [ ] Mobile + a11y OK
- [ ] Тесты + мониторинг
- [ ] RLS версионированы и audited

---

## 9. D. Рекомендуемый русский copy (основное)

- Заголовок логина: **Вход в СоветыДома**
- Заголовок регистрации: **Регистрация**
- Email: **Email**
- Пароль: **Пароль**
- Показать/скрыть: aria-label "Показать пароль" / "Скрыть пароль"
- Кнопка регистрации: **Зарегистрироваться**
- Кнопка входа: **Войти**
- Забыли пароль: **Забыли пароль?**
- После регистрации: **Проверьте почту для подтверждения. Мы отправили письмо на {email}.**
- Resend: **Отправить письмо ещё раз**
- Ошибка неверного пароля: **Неверный email или пароль**
- Email уже существует: **Аккаунт с таким email уже существует. Войдите или восстановите пароль.**
- После запроса сброса: **Письмо для сброса пароля отправлено. Проверьте почту.**
- Пароль изменён: **Пароль успешно изменён.**

(Полный список + требования к паролю — в идеальной спецификации выше.)

---

## 10. Дополнительные замечания и предыдущий контекст

- В июне уже были попытки починить email confirmation (resend добавили, обработку ошибок улучшили).
- Успешный тест 04.06 показал, что доставка **может** работать (письмо от maryana.sidorova@1001sovet.ru пришло).
- Проблема сейчас — нестабильность + полное отсутствие recovery + слабый UX.
- Связанные beads: RLS на profiles/saved_articles/comments (39y и др.), auth sync favorites (clq).

---

**Конец отчёта.**

Следующий шаг: скопируй промпт из раздела 1 и передай Codex / Claude Code. Создай бид sovetydoma-aau (уже создан) как эпик и начинай с P0.

Если нужно — могу сразу сгенерировать черновики компонентов или миграцию.
