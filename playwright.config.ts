import { defineConfig } from '@playwright/test';
import { browserOptions } from './server/browser';
const testPort = process.env.LINKSUNDER_E2E_PORT || '4317';
const baseURL = `http://127.0.0.1:${testPort}`;
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  timeout: 45000,
  use: { baseURL, launchOptions: browserOptions() },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
    env: { PORT: testPort, LINKSUNDER_DATA: '.e2e-data/' + Date.now() },
  },
});
