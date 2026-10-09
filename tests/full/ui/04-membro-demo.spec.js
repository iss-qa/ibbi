// Membro comum (menu restrito) e igreja demonstração (somente leitura).
const { test, expect } = require('@playwright/test');
const { sessao, vigiar, semErros } = require('./util');

test.describe('Membro comum', () => {
  test.use({ storageState: sessao('membro') });

  test('menu restrito e rotas da liderança redirecionam', async ({ page }) => {
    const erros = vigiar(page);
    await page.goto('/profile');
    const nav = page.locator('aside, nav').first();
    await expect(nav.getByRole('link', { name: 'Pedido de Oração' })).toBeVisible();
    for (const proibido of ['Pessoas', 'Campanhas', 'Configurações', 'Cuidado Pastoral']) {
      await expect(nav.getByRole('link', { name: proibido, exact: true })).toHaveCount(0);
    }
    await page.goto('/members');
    await expect(page).toHaveURL(/\/profile/);
    await page.goto('/configuracoes');
    await expect(page).toHaveURL(/\/profile/);
    semErros(erros, 'membro');
  });

  test('pedido de oração: opção de confidencialidade visível', async ({ page }) => {
    await page.goto('/prayer');
    await expect(page.getByRole('checkbox').first()).toBeVisible();
    await expect(page.getByText(/confidencial/i).first()).toBeVisible();
  });
});

test.describe('Demonstração', () => {
  test('entra sem cadastro, mostra a faixa e bloqueia alterações', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '👀 Ver demonstração' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
    await expect(page.getByText(/igreja demonstração/).first()).toBeVisible();
    await page.goto('/eventos');
    await page.getByRole('button', { name: '+ Novo evento' }).click();
    await page.getByLabel('Nome do evento').fill('Tentativa na demo');
    await page.getByLabel('Data').fill(new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10));
    await page.getByRole('button', { name: /Criar evento/ }).click();
    await expect(page.getByText(/não é possível alterar dados/)).toBeVisible();
  });
});
