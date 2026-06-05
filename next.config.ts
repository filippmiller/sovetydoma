import type { NextConfig } from 'next'

// Some hosts (e.g. env vars added from PowerShell) inject a UTF-8 BOM (﻿)
// and/or a trailing CR/LF into the value. Both break `new URL(...)` at build
// time with ERR_INVALID_URL, so sanitize before the value is inlined.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://1001sovet.ru')
  .replace(/^﻿/, '')
  .trim()

const buildCpus = Number.parseInt(process.env.NEXT_BUILD_CPUS || '', 10)

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    cpus: Number.isFinite(buildCpus) && buildCpus > 0 ? buildCpus : 4,
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 50,
  },
  env: {
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
  // Redirects for reclassified articles (new taxonomy). Note: with output:'export' these are
  // advisory (host must implement 301s too, e.g. via _redirects or server config). We also
  // generate legacy paths in article pages that serve soft JS+meta redirects + canonical.
  async redirects() {
    return [
      // zdorovie
      { source: '/layfkhaki/bezopasnost-doma-dlya-rebenka/', destination: '/zdorovie-i-bezopasnost/bezopasnost-doma-dlya-rebenka/', permanent: true },
      { source: '/layfkhaki/domashnyaya-aptechka-bez-lishnego/', destination: '/zdorovie-i-bezopasnost/domashnyaya-aptechka-bez-lishnego/', permanent: true },
      { source: '/layfkhaki/bezopasnaya-zaryadka-telefona-nochyu/', destination: '/zdorovie-i-bezopasnost/bezopasnaya-zaryadka-telefona-nochyu/', permanent: true },
      { source: '/layfkhaki/hranenie-lekarstv-doma/', destination: '/zdorovie-i-bezopasnost/hranenie-lekarstv-doma/', permanent: true },
      { source: '/layfkhaki/les-bezopasnost/', destination: '/zdorovie-i-bezopasnost/les-bezopasnost/', permanent: true },
      { source: '/layfkhaki/kleshchi-zashchita/', destination: '/zdorovie-i-bezopasnost/kleshchi-zashchita/', permanent: true },
      { source: '/layfkhaki/mini-remont-bez-instrumentov/', destination: '/zdorovie-i-bezopasnost/mini-remont-bez-instrumentov/', permanent: true },
      { source: '/dacha-i-ogorod/apteka-dlya-dachi/', destination: '/zdorovie-i-bezopasnost/apteka-dlya-dachi/', permanent: true },
      { source: '/rybalka/bezopasnost-na-ldu-rybalka/', destination: '/zdorovie-i-bezopasnost/bezopasnost-na-ldu-rybalka/', permanent: true },
      // semya
      { source: '/ekonomiya/spisok-pokupok-dlya-semi/', destination: '/semya-i-deti/spisok-pokupok-dlya-semi/', permanent: true },
      { source: '/ekonomiya/ekonomiya-na-shkolnyh-tovarah/', destination: '/semya-i-deti/ekonomiya-na-shkolnyh-tovarah/', permanent: true },
      { source: '/layfkhaki/kak-sobrat-rebenka-v-lager/', destination: '/semya-i-deti/kak-sobrat-rebenka-v-lager/', permanent: true },
      { source: '/layfkhaki/shkolnyy-ugolok-doma/', destination: '/semya-i-deti/shkolnyy-ugolok-doma/', permanent: true },
      { source: '/layfkhaki/semeynyy-kalendar-na-holodilnike/', destination: '/semya-i-deti/semeynyy-kalendar-na-holodilnike/', permanent: true },
      { source: '/layfkhaki/poryadok-v-igrushkah/', destination: '/semya-i-deti/poryadok-v-igrushkah/', permanent: true },
      { source: '/dom-i-uborka/kak-hranit-shkolnye-tetradi/', destination: '/semya-i-deti/kak-hranit-shkolnye-tetradi/', permanent: true },
      // otdyh
      { source: '/layfkhaki/dorozhnaya-sumka-za-20-minut/', destination: '/otdyh-i-puteshestviya/dorozhnaya-sumka-za-20-minut/', permanent: true },
      { source: '/ekonomiya/ekonomnyy-otpusk/', destination: '/otdyh-i-puteshestviya/ekonomnyy-otpusk/', permanent: true },
      { source: '/layfkhaki/letniy-cheklist-pered-otpuskom/', destination: '/otdyh-i-puteshestviya/letniy-cheklist-pered-otpuskom/', permanent: true },
      // pokupki
      { source: '/ekonomiya/pokupki-bez-pereplat/', destination: '/pokupki-i-tehnika/pokupki-bez-pereplat/', permanent: true },
      { source: '/ekonomiya/sravnenie-tsen-pered-pokupkoy/', destination: '/pokupki-i-tehnika/sravnenie-tsen-pered-pokupkoy/', permanent: true },
      { source: '/layfkhaki/telefon-v-zharkuyu-pogodu/', destination: '/pokupki-i-tehnika/telefon-v-zharkuyu-pogodu/', permanent: true },
      { source: '/layfkhaki/sel-telefon/', destination: '/pokupki-i-tehnika/sel-telefon/', permanent: true },
      { source: '/layfkhaki/zaryadka-telefona-layfhaki/', destination: '/pokupki-i-tehnika/zaryadka-telefona-layfhaki/', permanent: true },
      { source: '/layfkhaki/markirovka-provodov-i-zaryadok/', destination: '/pokupki-i-tehnika/markirovka-provodov-i-zaryadok/', permanent: true },
      { source: '/ekonomiya/keshbek-bonusy/', destination: '/pokupki-i-tehnika/keshbek-bonusy/', permanent: true },
      { source: '/ekonomiya/kak-vybrat-udlinitel-dlya-doma/', destination: '/pokupki-i-tehnika/kak-vybrat-udlinitel-dlya-doma/', permanent: true },
      { source: '/ekonomiya/kak-vybrat-shurupovert-dlya-doma/', destination: '/pokupki-i-tehnika/kak-vybrat-shurupovert-dlya-doma/', permanent: true },
      { source: '/dom-i-uborka/kak-hranit-bytovuyu-tehniku/', destination: '/pokupki-i-tehnika/kak-hranit-bytovuyu-tehniku/', permanent: true },
      { source: '/ekonomiya/kak-vybrat-nastolnuyu-lampu/', destination: '/pokupki-i-tehnika/kak-vybrat-nastolnuyu-lampu/', permanent: true },
      // krasota
      { source: '/layfkhaki/staticheskoe-elektrichestvo/', destination: '/krasota-i-uhod/staticheskoe-elektrichestvo/', permanent: true },
      { source: '/dom-i-uborka/zapah-iz-obuvi/', destination: '/krasota-i-uhod/zapah-iz-obuvi/', permanent: true },
      { source: '/layfkhaki/vysushit-obuv/', destination: '/krasota-i-uhod/vysushit-obuv/', permanent: true },
      { source: '/dom-i-uborka/krossovki-otmyt/', destination: '/krasota-i-uhod/krossovki-otmyt/', permanent: true },
      { source: '/dom-i-uborka/uhod-za-kozhanym-divanom/', destination: '/krasota-i-uhod/uhod-za-kozhanym-divanom/', permanent: true },
      { source: '/layfkhaki/kak-sushit-odezhdu-v-kvartire/', destination: '/krasota-i-uhod/kak-sushit-odezhdu-v-kvartire/', permanent: true },
      { source: '/dom-i-uborka/ubrat-sherst-s-divana-i-kovra/', destination: '/krasota-i-uhod/ubrat-sherst-s-divana-i-kovra/', permanent: true },
    ]
  },
}

export default nextConfig
