import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8788'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Reuses a server you already started with `npm run pages:dev`; only spins
  // one up itself when nothing is listening (e.g. in CI).
  webServer: {
    command: 'npm run pages:dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
