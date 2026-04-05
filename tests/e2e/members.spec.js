// @ts-check
const { test, expect } = require('@playwright/test');
const { loginViaUI } = require('../helpers/auth');

test.describe('Members E2E - Happy Path', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('should navigate to members page', async ({ page }) => {
    await page.click('a[href="/members"]');
    await page.waitForURL('**/members');

    await expect(page.locator('text=Membros').first()).toBeVisible();
  });

  test('should open new member form', async ({ page }) => {
    await page.click('a[href="/members"]');
    await page.waitForURL('**/members');

    // Click "+ Novo" button
    await page.click('button:has-text("Novo")');

    await expect(page.locator('text=Novo membro').or(page.locator('text=Preencha os dados'))).toBeVisible({ timeout: 5000 });
  });

  test('should show photo required validation', async ({ page }) => {
    await page.click('a[href="/members"]');
    await page.waitForURL('**/members');
    await page.click('button:has-text("Novo")');

    // Fill only name without photo
    await page.fill('input[placeholder="Nome e sobrenome"]', 'Teste Sem Foto');

    // Try to submit
    await page.click('button[type="submit"]:has-text("Salvar")');

    // Should show photo error
    await expect(page.locator('text=Foto obrigatória')).toBeVisible({ timeout: 3000 });
  });

  test('should search members', async ({ page }) => {
    await page.click('a[href="/members"]');
    await page.waitForURL('**/members');

    // Type in search
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Isaias');
      await page.waitForTimeout(500);
      await expect(page.locator('text=Isaias').first()).toBeVisible();
    }
  });

  test('should paginate members list', async ({ page }) => {
    await page.click('a[href="/members"]');
    await page.waitForURL('**/members');

    // Check pagination exists
    const pagination = page.locator('text=registros').or(page.locator('text=Página'));
    await expect(pagination.first()).toBeVisible({ timeout: 5000 });
  });
});
