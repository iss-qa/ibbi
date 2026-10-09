// @ts-check
// Suíte completa e isolada do PastorIA (tests/full): sobe WhatsApp falso + backend de teste
// (banco pastoria_e2e, sem scheduler, sem IA/email/gateway) + frontend, e roda API + UI.
// Uso: npm run test:full   (relatório: tests/full/report)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const E2E = require('./tests/full/config');

// Chromium já baixado no cache (as versões do Playwright instaladas podem não bater)
const cacheChromium = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const executablePath = process.env.PW_CHROMIUM || (fs.existsSync(cacheChromium) ? cacheChromium : undefined);

module.exports = defineConfig({
  testDir: './tests/full',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1, // o estado do banco é compartilhado entre os testes (ordem importa)
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'tests/full/report' }]],
  outputDir: 'tests/full/test-results',
  use: {
    baseURL: E2E.webUrl,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: [
    { command: 'node tests/full/mock-evolution.js', url: `${E2E.mockUrl}/__outbox`, reuseExistingServer: false, timeout: 20000 },
    { command: 'node tests/full/start-backend.js', url: `${E2E.apiUrl}/health`, reuseExistingServer: false, timeout: 60000 },
    {
      command: `npx vite --port ${E2E.portas.web} --strictPort`,
      cwd: path.join(__dirname, 'frontend'),
      url: E2E.webUrl,
      reuseExistingServer: false,
      timeout: 60000,
      env: { VITE_API_URL: E2E.apiUrl, VITE_DEFAULT_TENANT: E2E.igrejas.a, VITE_DEMO_ENABLED: 'true', VITE_DEV_USERS: '' },
    },
  ],
  projects: [
    { name: 'api', testDir: './tests/full/api' },
    { name: 'setup-ui', testDir: './tests/full/ui', testMatch: /auth\.setup\.js/, dependencies: ['api'] },
    { name: 'ui', testDir: './tests/full/ui', testIgnore: /auth\.setup\.js/, dependencies: ['setup-ui'], use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
  ],
});
