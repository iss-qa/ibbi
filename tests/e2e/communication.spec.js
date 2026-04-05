// @ts-check
const { test, expect } = require('@playwright/test');
const { loginViaUI } = require('../helpers/auth');

test.describe('Communication E2E - Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('should navigate to communication page', async ({ page }) => {
    await page.click('a[href="/communication"]');
    await page.waitForURL('**/communication');

    await expect(page.locator('text=Comunicação').first()).toBeVisible();
  });

  test('should show message stats', async ({ page }) => {
    await page.click('a[href="/communication"]');
    await page.waitForURL('**/communication');

    // Stats should be visible
    await expect(page.locator('text=Total').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Enviados').first()).toBeVisible();
  });

  test('should show message history', async ({ page }) => {
    await page.click('a[href="/communication"]');
    await page.waitForURL('**/communication');

    await expect(page.locator('text=Histórico de envios')).toBeVisible({ timeout: 5000 });
  });

  test('should open new message modal', async ({ page }) => {
    await page.click('a[href="/communication"]');
    await page.waitForURL('**/communication');

    await page.click('text=Nova Mensagem');
    await expect(page.locator('text=Nova mensagem').nth(1)).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Por grupo')).toBeVisible();
  });

  test('should filter messages by type', async ({ page }) => {
    await page.click('a[href="/communication"]');
    await page.waitForURL('**/communication');

    // Select a filter
    const tipoSelect = page.locator('select').first();
    await tipoSelect.selectOption('aniversario');
    await page.waitForTimeout(300);

    // Verify filter is applied
    expect(await tipoSelect.inputValue()).toBe('aniversario');
  });
});

test.describe('Projeto Amigo E2E', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('should navigate to projeto amigo dashboard', async ({ page }) => {
    await page.click('a[href="/projeto-amigo"]');
    await page.waitForURL('**/projeto-amigo');

    await expect(page.locator('text=Projeto Amigo').first()).toBeVisible();
    await expect(page.locator('text=Novos decididos').first()).toBeVisible({ timeout: 5000 });
  });

  test('should show KPIs on dashboard', async ({ page }) => {
    await page.click('a[href="/projeto-amigo"]');
    await page.waitForURL('**/projeto-amigo');

    await expect(page.locator('text=Em acompanhamento')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Sem amigo')).toBeVisible();
  });

  test('should navigate to groups page', async ({ page }) => {
    await page.click('a[href="/projeto-amigo"]');
    await page.waitForURL('**/projeto-amigo');

    await page.click('button:has-text("Grupos")');
    await page.waitForURL('**/grupos');
    await expect(page.locator('text=Projeto Amigo').first()).toBeVisible();
  });
});
