import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'https://1001sovet.ru'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
})
