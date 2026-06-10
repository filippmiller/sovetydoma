# VK: получить токен для загрузки фото (VK_PHOTO_ACCESS_TOKEN)

## Почему посты уходят без картинок

`photos.getWallUploadServer` / `photos.saveWallPhoto` **нельзя вызывать групповым токеном** —
VK возвращает ошибку (обычно 27 "group authorization failed" или 15 "access denied").
Нужен **пользовательский** токен администратора группы с правами `photos` + `wall`.
Код воркера уже готов: если задан секрет `VK_PHOTO_ACCESS_TOKEN`, фото загружается
им, а `wall.post` по-прежнему уходит групповым `VK_ACCESS_TOKEN`.

## Как получить пользовательский токен

### Вариант A — Standalone-приложение (официальный)

1. https://dev.vk.com → «Мои приложения» → создать приложение типа **Standalone**.
2. В настройках: состояние «Приложение включено и видно всем».
3. Открыть в браузере (залогинившись под админом группы):

```
https://oauth.vk.com/authorize?client_id=<APP_ID>&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=photos,wall,groups,offline&response_type=token&v=5.199
```

4. После подтверждения токен будет в адресной строке (`#access_token=...`).
   `offline` = токен бессрочный.

> Если VK не выдаёт implicit-flow для нового приложения (политика 2024+),
> используйте вариант B.

### Вариант B — VK ID с PKCE (если implicit заблокирован)

Через https://id.vk.com OAuth с `scope=photos wall` и обмен кода на access_token
(client_id = VK_ID_APP_ID, уже есть в секретах). Токен пользователя VK ID тоже
подходит для photos.* методов, если приложение имеет доступ к этим скоупам.

## Установка секрета (без BOM!)

```bash
cd workers/subscriptions
# secrets.json: { "VK_PHOTO_ACCESS_TOKEN": "vk1.a...." }
npx wrangler secret bulk secrets.json
```

НЕ использовать `echo <token> | wrangler secret put` из PowerShell — BOM портит значение
(см. memory: wrangler-secret-bom-gotcha).

## Проверка

```bash
# Должен вернуть upload_url, а не error 27:
curl "https://api.vk.com/method/photos.getWallUploadServer?group_id=<GROUP_ID>&access_token=<USER_TOKEN>&v=5.199"

# Потом живой пост:
curl -X POST https://<worker-host>/admin/social/vk/post \
  -H "Content-Type: application/json" -H "x-admin-key: <ADMIN_API_KEY>" \
  -d '{"articleSlug":"<slug>","requirePhoto":true,"allowLinkFallback":false}'
```

Ожидаемый `publishMode: "photo_upload"` в ответе и в `social_publications.provider_payload`.
