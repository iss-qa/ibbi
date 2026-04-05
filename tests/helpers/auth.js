// Helper to get auth token and login via API
const API_URL = process.env.TEST_API_URL || 'http://localhost:3001/api';

// Master credentials for testing — set via env vars or .env.test file
// Usage: TEST_LOGIN=seulogin TEST_PASSWORD=suasenha npm run test:api
const TEST_LOGIN = process.env.TEST_LOGIN || '';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '';

/**
 * Get auth token via API login
 */
async function getAuthToken(request) {
  if (!TEST_LOGIN || !TEST_PASSWORD) {
    throw new Error(
      'TEST_LOGIN and TEST_PASSWORD env vars are required.\n' +
      'Run: TEST_LOGIN=seulogin TEST_PASSWORD=suasenha npm run test:api'
    );
  }

  const res = await request.post(`${API_URL}/auth/login`, {
    data: { login: TEST_LOGIN, senha: TEST_PASSWORD },
  });

  if (!res.ok()) {
    throw new Error(`Auth failed: ${res.status()} ${await res.text()}`);
  }

  const data = await res.json();
  return { token: data.token, user: data.user };
}

/**
 * Login via browser UI and store session
 */
async function loginViaUI(page, login, password) {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:4173';
  await page.goto(`${baseURL}/login`);
  await page.fill('input[placeholder="seu login"]', login || TEST_LOGIN);
  await page.fill('input[type="password"]', password || TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

/**
 * Create authenticated API request context
 */
async function authHeaders(request) {
  const { token } = await getAuthToken(request);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

module.exports = { getAuthToken, loginViaUI, authHeaders, API_URL, TEST_LOGIN, TEST_PASSWORD };
