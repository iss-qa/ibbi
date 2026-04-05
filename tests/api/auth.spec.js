// @ts-check
const { test, expect } = require('@playwright/test');
const { API_URL, TEST_LOGIN, TEST_PASSWORD } = require('../helpers/auth');

test.describe('Auth API - Happy Path', () => {
  test('should login with valid credentials', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { login: TEST_LOGIN, senha: TEST_PASSWORD },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user).toBeTruthy();
    expect(body.user.nome).toBeTruthy();
  });

  test('should reject invalid credentials', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { login: 'invalid_user', senha: 'wrong_password' },
    });

    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('should get current user with token', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { login: TEST_LOGIN, senha: TEST_PASSWORD },
    });
    const { token } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(meRes.status()).toBe(200);
    const body = await meRes.json();
    expect(body.user.nome).toBeTruthy();
  });

  test('should reject requests without token', async ({ request }) => {
    const res = await request.get(`${API_URL}/persons`);

    expect(res.status()).toBe(401);
  });

  test('API health check should return ok', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
