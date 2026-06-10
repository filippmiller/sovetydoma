import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served under https://1001sovet.ru/vk-app/ (Caddy handle_path strips the prefix,
// so assets resolve under /vk-app/...). No new DNS/cert needed.
export default defineConfig({
  plugins: [react()],
  base: '/vk-app/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 5174,
    host: true,
  },
})
