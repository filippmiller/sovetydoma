# SEO Legacy Redirects — Nginx Configuration Handoff

> Date: 2026-06-06
> Project: 1001sovet.ru
> Host: Timeweb (nginx)

## Context

`next.config.ts` contains `redirects()` with 36 legacy URL mappings, but the site uses `output: 'export'`. Next.js static export **does not emit HTTP 301 responses** — the `redirects()` config is advisory-only and ignored at build time.

On the current production host, legacy URLs (e.g. `/layfkhaki/bezopasnost-doma-dlya-rebenka/`) likely return **200 OK** with a soft JS/meta redirect instead of a proper **301 Moved Permanently**. This dilutes ranking signals and wastes crawl budget.

## Action Required

Install the nginx rewrite rules below on the Timeweb server so that every legacy URL returns a real `301` before the request ever reaches the static files.

## Nginx Configuration Block

Add this **inside the `server {}` block** for `1001sovet.ru` (typically in `/etc/nginx/sites-enabled/1001sovet.ru` or via Timeweb control panel).

```nginx
# ============================================
# Legacy article redirects (taxonomy migration)
# Generated from next.config.ts — DO NOT EDIT MANUALLY
# Last synced: 2026-06-06
# ============================================

# zdorovie-i-bezopasnost
rewrite ^/layfkhaki/bezopasnost-doma-dlya-rebenka/$       /zdorovie-i-bezopasnost/bezopasnost-doma-dlya-rebenka/       permanent;
rewrite ^/layfkhaki/domashnyaya-aptechka-bez-lishnego/$   /zdorovie-i-bezopasnost/domashnyaya-aptechka-bez-lishnego/   permanent;
rewrite ^/layfkhaki/bezopasnaya-zaryadka-telefona-nochyu/$ /zdorovie-i-bezopasnost/bezopasnaya-zaryadka-telefona-nochyu/ permanent;
rewrite ^/layfkhaki/hranenie-lekarstv-doma/$             /zdorovie-i-bezopasnost/hranenie-lekarstv-doma/             permanent;
rewrite ^/layfkhaki/les-bezopasnost/$                     /zdorovie-i-bezopasnost/les-bezopasnost/                     permanent;
rewrite ^/layfkhaki/kleshchi-zashchita/$                  /zdorovie-i-bezopasnost/kleshchi-zashchita/                  permanent;
rewrite ^/layfkhaki/mini-remont-bez-instrumentov/$        /zdorovie-i-bezopasnost/mini-remont-bez-instrumentov/        permanent;
rewrite ^/dacha-i-ogorod/apteka-dlya-dachi/$              /zdorovie-i-bezopasnost/apteka-dlya-dachi/                   permanent;
rewrite ^/rybalka/bezopasnost-na-ldu-rybalka/$            /zdorovie-i-bezopasnost/bezopasnost-na-ldu-rybalka/          permanent;

# semya-i-deti
rewrite ^/ekonomiya/spisok-pokupok-dlya-semi/$            /semya-i-deti/spisok-pokupok-dlya-semi/                      permanent;
rewrite ^/ekonomiya/ekonomiya-na-shkolnyh-tovarah/$       /semya-i-deti/ekonomiya-na-shkolnyh-tovarah/                 permanent;
rewrite ^/layfkhaki/kak-sobrat-rebenka-v-lager/$          /semya-i-deti/kak-sobrat-rebenka-v-lager/                    permanent;
rewrite ^/layfkhaki/shkolnyy-ugolok-doma/$                /semya-i-deti/shkolnyy-ugolok-doma/                          permanent;
rewrite ^/layfkhaki/semeynyy-kalendar-na-holodilnike/$    /semya-i-deti/semeynyy-kalendar-na-holodilnike/              permanent;
rewrite ^/layfkhaki/poryadok-v-igrushkah/$                /semya-i-deti/poryadok-v-igrushkah/                          permanent;
rewrite ^/dom-i-uborka/kak-hranit-shkolnye-tetradi/$      /semya-i-deti/kak-hranit-shkolnye-tetradi/                   permanent;

# otdyh-i-puteshestviya
rewrite ^/layfkhaki/dorozhnaya-sumka-za-20-minut/$        /otdyh-i-puteshestviya/dorozhnaya-sumka-za-20-minut/         permanent;
rewrite ^/ekonomiya/ekonomnyy-otpusk/$                    /otdyh-i-puteshestviya/ekonomnyy-otpusk/                     permanent;
rewrite ^/layfkhaki/letniy-cheklist-pered-otpuskom/$      /otdyh-i-puteshestviya/letniy-cheklist-pered-otpuskom/       permanent;

# pokupki-i-tehnika
rewrite ^/ekonomiya/pokupki-bez-pereplat/$                /pokupki-i-tehnika/pokupki-bez-pereplat/                     permanent;
rewrite ^/ekonomiya/sravnenie-tsen-pered-pokupkoy/$       /pokupki-i-tehnika/sravnenie-tsen-pered-pokupkoy/            permanent;
rewrite ^/layfkhaki/telefon-v-zharkuyu-pogodu/$           /pokupki-i-tehnika/telefon-v-zharkuyu-pogodu/                permanent;
rewrite ^/layfkhaki/sel-telefon/$                         /pokupki-i-tehnika/sel-telefon/                              permanent;
rewrite ^/layfkhaki/zaryadka-telefona-layfhaki/$          /pokupki-i-tehnika/zaryadka-telefona-layfhaki/               permanent;
rewrite ^/layfkhaki/markirovka-provodov-i-zaryadok/$      /pokupki-i-tehnika/markirovka-provodov-i-zaryadok/           permanent;
rewrite ^/ekonomiya/keshbek-bonusy/$                      /pokupki-i-tehnika/keshbek-bonusy/                           permanent;
rewrite ^/ekonomiya/kak-vybrat-udlinitel-dlya-doma/$      /pokupki-i-tehnika/kak-vybrat-udlinitel-dlya-doma/           permanent;
rewrite ^/ekonomiya/kak-vybrat-shurupovert-dlya-doma/$    /pokupki-i-tehnika/kak-vybrat-shurupovert-dlya-doma/         permanent;
rewrite ^/dom-i-uborka/kak-hranit-bytovuyu-tehniku/$      /pokupki-i-tehnika/kak-hranit-bytovuyu-tehniku/              permanent;
rewrite ^/ekonomiya/kak-vybrat-nastolnuyu-lampu/$         /pokupki-i-tehnika/kak-vybrat-nastolnuyu-lampu/              permanent;

# krasota-i-uhod
rewrite ^/layfkhaki/staticheskoe-elektrichestvo/$         /krasota-i-uhod/staticheskoe-elektrichestvo/                 permanent;
rewrite ^/dom-i-uborka/zapah-iz-obuvi/$                   /krasota-i-uhod/zapah-iz-obuvi/                              permanent;
rewrite ^/layfkhaki/vysushit-obuv/$                       /krasota-i-uhod/vysushit-obuv/                              permanent;
rewrite ^/dom-i-uborka/krossovki-otmyt/$                  /krasota-i-uhod/krossovki-otmyt/                             permanent;
rewrite ^/dom-i-uborka/uhod-za-kozhanym-divanom/$        /krasota-i-uhod/uhod-za-kozhanym-divanom/                   permanent;
rewrite ^/layfkhaki/kak-sushit-odezhdu-v-kvartire/$      /krasota-i-uhod/kak-sushit-odezhdu-v-kvartire/              permanent;
rewrite ^/dom-i-uborka/ubrat-sherst-s-divana-i-kovra/$   /krasota-i-uhod/ubrat-sherst-s-divana-i-kovra/              permanent;

# ============================================
# End legacy redirects
# ============================================
```

## Verification Steps

After deploying the nginx config, test with curl:

```bash
curl -I https://1001sovet.ru/layfkhaki/bezopasnost-doma-dlya-rebenka/
# Expected: HTTP/2 301 + Location: /zdorovie-i-bezopasnost/bezopasnost-doma-dlya-rebenka/

curl -I https://1001sovet.ru/ekonomiya/pokupki-bez-pereplat/
# Expected: HTTP/2 301 + Location: /pokupki-i-tehnika/pokupki-bez-pereplat/
```

## Important Notes

1. **Soft redirects are preserved in the React app** — article pages still render canonical + meta-refresh for legacy paths as a safety net, but the nginx 301 should intercept first.
2. **Do NOT remove** the `redirects()` array from `next.config.ts` — it documents intent and helps local dev.
3. If Timeweb uses Apache instead of nginx, convert `rewrite ^...$ ... permanent;` to:
   ```apache
   Redirect 301 /old/path/ /new/path/
   ```
4. Keep this report in sync with `next.config.ts` whenever new legacy redirects are added.
