// Login pela tela (master e membro) e salva a sessão para os demais testes de UI.
const { test: setup, expect } = require('@playwright/test');
const path = require('path');
const E2E = require('../config');

const AUTH = path.join(__dirname, '../.auth');

for (const [perfil, destino] of [['master', /\/(dashboard|primeiros-passos)/], ['membro', /\/profile/]]) {
  setup(`login pela tela: ${perfil}`, async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Igreja Teste E2E')).toBeVisible();
    await page.getByPlaceholder('seu login').fill(perfil);
    await page.getByPlaceholder('sua senha').fill(E2E.senha);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(destino);
    await page.context().storageState({ path: path.join(AUTH, `${perfil}.json`) });
  });
}

setup('senha errada mostra erro e não entra', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('seu login').fill('admin');
  await page.getByPlaceholder('sua senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('p.text-red-600')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
