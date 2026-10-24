import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 960 },
        colorScheme: 'light',
      },
    },
  ],
  webServer: [
    {
      command:
        '../.venv/bin/uvicorn app.main:app --app-dir ../backend --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/api/health',
      env: { QA_MODE: 'demo' },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
