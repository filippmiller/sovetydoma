import type { NextConfig } from 'next'

// Some hosts (e.g. env vars added from PowerShell) inject a UTF-8 BOM (﻿)
// and/or a trailing CR/LF into the value. Both break `new URL(...)` at build
// time with ERR_INVALID_URL, so sanitize before the value is inlined.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://1001sovet.ru')
  .replace(/^﻿/, '')
  .trim()

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_SITE_URL: siteUrl,
  },
}

export default nextConfig
