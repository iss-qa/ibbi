// Páginas públicas: landing, planos, termos/privacidade, cadastro e versão mobile.
const { test, expect } = require('@playwright/test');
const { vigiar, semErros } = require('./util');
const { cliente } = require('../helpers');

test.describe('Páginas públicas', () => {
  test('landing: slogan, chamada para cadastro, demonstração e planos com os preços', async ({ page }) => {
    const erros = vigiar(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/PastorIA/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Quem falta');
    await expect(page.getByRole('link', { name: /Começar 14 dias grátis/ })).toHaveAttribute('href', '/cadastro');
    await expect(page.getByRole('link', { name: '👀 Ver demonstração' })).toBeVisible();
    const planos = page.locator('#planos');
    await planos.scrollIntoViewIfNeeded();
    for (const p of ['Semente', 'Crescer', 'Multiplicar', 'Rede']) await expect(planos.getByText(p, { exact: true }).first()).toBeVisible();
    for (const v of ['47', '99', '197']) await expect(planos.getByText(new RegExp(`R\\$\\s*${v}\\b`)).first()).toBeVisible();
    semErros(erros, '/');
  });

  test('rodapé leva aos Termos e à Privacidade', async ({ page }) => {
    await page.goto('/');
    await page.locator('footer').getByRole('link', { name: /Termos/ }).click();
    await expect(page).toHaveURL(/\/termos/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Termos/);
    await expect(page.getByText(/SAIR/).first()).toBeVisible();
    await page.goto('/privacidade');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Privacidade/);
    await expect(page.getByText(/LGPD/).first()).toBeVisible();
  });

  test('?ref= da landing é guardado para o cadastro', async ({ page }) => {
    await page.goto('/?ref=igreja-e2e');
    await page.getByRole('link', { name: /Começar 14 dias grátis/ }).click();
    await expect(page).toHaveURL(/\/cadastro/);
    await expect(page.getByText(/indica/i).first()).toBeVisible();
  });

  test('cadastro: botão só habilita com o aceite dos termos; link de voltar à landing', async ({ page }) => {
    await page.goto('/cadastro?plano=crescer');
    const criar = page.getByRole('button', { name: 'Criar minha igreja grátis' });
    await page.getByPlaceholder('Ex.: Igreja Batista da Paz').fill('Igreja Botao Teste');
    await page.getByPlaceholder('Pastor(a) responsável').fill('Pr. Botão');
    await page.getByPlaceholder('(71) 99999-9999').fill('71988887777');
    await page.getByPlaceholder('voce@igreja.com.br').fill('botao@e2e.test');
    await expect(criar).toBeDisabled();
    await page.getByRole('checkbox').check();
    await expect(criar).toBeEnabled();
    await page.getByRole('link', { name: 'Voltar para a página inicial', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('mobile (390px): landing sem rolagem horizontal', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(392);
    await ctx.close();
  });

  test('link de cadastro (390px): orienta a enviar foto real da pessoa', async ({ browser, request }, info) => {
    const { token } = await (await (await cliente(request)).post('/invitations', {})).json();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(`/external/${token}`);
    await expect(page.getByText(/Envie uma foto real sua/)).toBeVisible();
    await expect(page.getByText(/Não use cards de bom dia/)).toBeVisible();
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(392);
    await page.screenshot({ path: info.outputPath('cadastro-foto.png') });
    await ctx.close();
  });

  test('manifesto PWA e service worker publicados', async ({ request }) => {
    const m = await (await request.get('/site.webmanifest')).json();
    expect(m.name).toBe('PastorIA');
    expect(m.start_url).toContain('/dashboard');
    expect(m.shortcuts.length).toBeGreaterThanOrEqual(3);
    const sw = await (await request.get('/sw.js')).text();
    expect(sw).toMatch(/\/api/); // nunca guarda /api em cache
  });
});
