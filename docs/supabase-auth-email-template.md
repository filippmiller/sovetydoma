# Supabase Auth confirmation email

Use this for `Authentication -> Email Templates -> Confirm signup` in the
Supabase project `plwkjdpuxjkmpkqiqzkk`.

Required Auth URL settings:

- Site URL: `https://1001sovet.ru`
- Additional Redirect URLs:
  - `https://1001sovet.ru/**`
  - `http://localhost:3000/**`
  - `http://127.0.0.1:3000/**`

Subject:

```text
SovetyDoma: confirm your email
```

Do not use a Cyrillic subject while Supabase Auth is sending through custom SMTP:
the current GoTrue/Supabase SMTP path stored/sent the non-ASCII subject as
question marks. Keep the subject ASCII and put the Russian brand/message in the
HTML body.

HTML body:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Подтвердите почту в СоветыДома</title>
  </head>
  <body style="margin:0;padding:0;background:#f7f3ee;color:#1f1f1f;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3ee;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #eadfd4;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#c43b2f;padding:24px 28px;color:#ffffff;">
                <div style="font-size:25px;font-weight:800;line-height:1.2;">СоветыДома</div>
                <div style="font-size:14px;line-height:1.5;opacity:.92;margin-top:6px;">простые советы, которые хочется сохранить</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 10px;">
                <h1 style="margin:0 0 14px;font-size:26px;line-height:1.25;color:#1f1f1f;">Подтвердите почту</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#4c4c4c;">
                  Остался один шаг: подтвердите email, чтобы сохранять любимые статьи, ставить оценки, писать комментарии и возвращаться к полезным советам без поисков по всему интернету.
                </p>
                <p style="margin:0 0 24px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#c43b2f;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:14px 22px;border-radius:9px;">
                    Подтвердить почту
                  </a>
                </p>
                <p style="margin:0 0 22px;font-size:13px;line-height:1.55;color:#777;">
                  Если кнопка не открывается, скопируйте ссылку в браузер:<br>
                  <span style="word-break:break-all;color:#a3332a;">{{ .ConfirmationURL }}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7ee;border:1px solid #f0dcc7;border-radius:12px;">
                  <tr>
                    <td style="padding:18px 18px 16px;">
                      <div style="font-size:13px;font-weight:800;color:#c43b2f;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Пара советов на вход</div>
                      <p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#3f3f3f;">
                        1. Если крышка банки не поддается, наденьте резинку на крышку: сцепление станет лучше, а характер спокойнее.
                      </p>
                      <p style="margin:0;font-size:15px;line-height:1.55;color:#3f3f3f;">
                        2. Перед походом в магазин сфотографируйте холодильник: список покупок иногда уже смотрит на вас с полки.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #eee5dd;padding:18px 28px 24px;color:#777;font-size:13px;line-height:1.55;">
                Вы получили это письмо, потому что зарегистрировались на 1001sovet.ru.
                Если это были не вы, просто проигнорируйте письмо.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

Notes:

- Supabase built-in templates are static. The two advice items above are fixed.
- Truly random advice in every auth email requires a custom Auth email hook or a
  separate transactional email service that generates the message body at send time.
- Production Auth SMTP is configured through Supabase CLI to send via Mailcow
  `mail.filippmiller.com:587` using a `1001sovet.ru` mailbox. Keep the password
  only in `C:\Users\filip\.secrets\1001sovet-mailcow-mailboxes.env`; do not
  commit SMTP credentials.
- Production Auth rate limits were raised for QA/new-user bursts:
  `email_sent = 60`, `sign_in_sign_ups = 120`, `token_verifications = 120`,
  `max_frequency = "5s"`.
