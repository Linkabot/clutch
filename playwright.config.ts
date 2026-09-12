// Playwright configuration: runs tests/e2e against a production build served
// by `vite preview`, using a single iPhone/WebKit project so results match
// real Safari behaviour on iOS.
// Depends on: @playwright/test.
// Depended on by: `npm run e2e`, .github/workflows/ci.yml (Step 13).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'iphone-webkit',
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/clutch/',
    reuseExistingServer: !process.env.CI,
  },
});
