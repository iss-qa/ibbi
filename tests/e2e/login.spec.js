// @ts-check
const { test, expect } = require('@playwright/test');
const { TEST_LOGIN, TEST_PASSWORD } = require('../helpers/auth');

test.describe('Login E2E', () => {
  test('should login and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toContainText('Bem-vindo');

    await page.fill('input[placeholder="seu login"]', TEST_LOGIN);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should show error with wrong credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[placeholder="seu login"]', 'wrong_user');
    await page.fill('input[type="password"]', 'wrong_pass');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Falha no login').or(page.locator('text=Login ou senha'))).toBeVisible({ timeout: 5000 });
  });

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login', { timeout: 10000 });
  });
});
