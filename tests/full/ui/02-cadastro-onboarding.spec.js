// Jornada completa de uma igreja nova: cadastro → credenciais → login → troca de senha → aceite dos termos.
const { test, expect } = require('@playwright/test');
const { vigiar, semErros } = require('./util');

test('igreja nova: cadastro, primeiro acesso e primeiros passos', async ({ page }) => {
  test.setTimeout(90000);
  const erros = vigiar(page);
  await page.goto('/cadastro?plano=multiplicar');
  await page.getByPlaceholder('Ex.: Igreja Batista da Paz').fill('Igreja Jornada UI');
  await page.getByPlaceholder('Pastor(a) responsável').fill('Pr. Jornada');
  await page.getByPlaceholder('(71) 99999-9999').fill('71977776666');
  await page.getByPlaceholder('voce@igreja.com.br').fill('jornada-ui@e2e.test');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Criar minha igreja grátis' }).click();

  // Credenciais exibidas uma única vez
  await expect(page.getByText('Senha temporária')).toBeVisible({ timeout: 20000 });
  const caixa = page.getByText('Senha temporária').locator('..');
  const senhaTemp = (await caixa.innerText()).replace('Senha temporária', '').trim();
  expect(senhaTemp.length).toBeGreaterThanOrEqual(8);
  await page.getByRole('button', { name: 'Entrar agora' }).click();

  // Login com as credenciais (igreja e login já preenchidos pelo cadastro)
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Bem-vindo à Igreja Jornada UI' })).toBeVisible();
  const login = page.getByPlaceholder('seu login');
  if (!(await login.inputValue())) await login.fill('pr');
  if (!(await page.getByPlaceholder('sua senha').inputValue())) await page.getByPlaceholder('sua senha').fill(senhaTemp);
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Troca obrigatória de senha
  await expect(page).toHaveURL(/force-change-password/);
  await page.getByPlaceholder('mínimo 6 caracteres').fill('NovaSenha@123');
  await page.getByPlaceholder('repita a nova senha').fill('NovaSenha@123');
  await page.getByRole('button', { name: 'Salvar Nova Senha' }).click();
  await expect(page).not.toHaveURL(/force-change-password/, { timeout: 15000 });

  // Primeiros passos: o aceite feito no cadastro já conta (sem pedir de novo)
  await page.goto('/primeiros-passos');
  await expect(page.getByText(/Aceitar os Termos e a Política de Privacidade/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aceitar' })).toHaveCount(0);
  await expect(page.getByText(/Conectar o WhatsApp da igreja/)).toBeVisible();
  await expect(page.getByText(/Trazer as pessoas da igreja/)).toBeVisible();
  // Menu lateral oferece os primeiros passos enquanto não concluir
  await expect(page.getByRole('link', { name: /Primeiros passos/ })).toBeVisible();
  semErros(erros, 'cadastro → onboarding');
});
