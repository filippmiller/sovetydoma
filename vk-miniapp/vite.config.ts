import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VK Mini App is served from the root of its host (vk.1001sovet.ru), so base '/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 5174,
    host: true,
  },
})
