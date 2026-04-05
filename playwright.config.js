// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

// Load .env.test
require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'tests/report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: process.env.TEST_API_URL || 'http://localhost:3001/api' },
    },
    {
      name: 'e2e',
      testDir: './tests/e2e',
    },
    {
      name: 'health',
      testDir: './tests/health',
      use: { baseURL: process.env.TEST_API_URL || 'http://localhost:3001/api' },
    },
  ],
});
