// Assinatura pela tela: sino de fatura no Dashboard, pagamento com QR do Pix (Woovi falsa) com
// confirmação automática, e igreja suspensa presa na Assinatura até pagar.
const { test, expect } = require('@playwright/test');
const mongoose = require('mongoose');
const E2E = require('../config');
const { sessao, vigiar, semErros } = require('./util');

test.use({ storageState: sessao('master') });

const api = (p) => `${E2E.apiUrl}${p}`;
const mock = (p) => `${E2E.mockUrl}${p}`;
const SHOTS = process.env.E2E_SHOTS; // pasta opcional para capturas de tela
const PLATFORM_KEY = 'platform_token'; // services/platformApi.js

test.describe.serial('Assinatura e Pix', () => {
  let token;
  let igreja;
  const h = () => ({ Authorization: `Bearer ${token}` });
  const pagarNaWoovi = async (request, faturaId) => {
    const lista = await (await request.get(mock('/__woovi/charges'))).json();
    const c = lista.filter((x) => x.correlationID.startsWith(`pastoria-${faturaId}-`) && x.status === 'ACTIVE').pop();
    await request.post(mock(`/__woovi/pay/${encodeURIComponent(c.correlationID)}`));
  };
  const shot = (page, nome) => SHOTS && page.screenshot({ path: `${SHOTS}/${nome}.png`, fullPage: false });

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    token = (await (await ctx.post(api('/platform/auth/login'), { data: { email: 'plataforma@e2e.test', senha: 'Plataforma@E2e123' } })).json()).token;
    igreja = (await (await ctx.get(api('/platform/tenants'), { headers: h() })).json()).find((t) => t.slug === E2E.igrejas.a);
    await ctx.put(api(`/platform/tenants/${igreja._id}`), { headers: h(), data: { billing: { isento: false } } });
    await ctx.dispose();
    // O spec 11 (indicação) dá 1 mês grátis a esta igreja: com crédito a fatura nasce paga, sem Pix.
    expect(E2E.banco).toMatch(/_e2e$/);
    await mongoose.connect(E2E.banco);
    try {
      await mongoose.connection.collection('tenants').updateOne({ _id: new mongoose.Types.ObjectId(igreja._id) }, { $set: { 'indicacao.creditosMeses': 0 } });
    } finally {
      await mongoose.disconnect();
    }
  });

  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    await ctx.put(api(`/platform/tenants/${igreja._id}`), { headers: h(), data: { billing: { isento: true } } });
    await ctx.dispose();
  });

  test('sino do Dashboard avisa a fatura e o Pix é pago pelo QR', async ({ page, request }) => {
    test.setTimeout(60000);
    const erros = vigiar(page);
    const fatura = await (await request.post(api(`/platform/tenants/${igreja._id}/invoices`), { headers: h(), data: {} })).json();
    expect(fatura.gateway?.provider).toBe('woovi');

    await page.goto('/dashboard');
    const sino = page.getByRole('button', { name: /Notificações: Fatura em aberto/ });
    await expect(sino).toBeVisible();
    await sino.click();
    const pop = page.getByRole('dialog', { name: 'Notificações' });
    await expect(pop.getByText('R$ 197,00', { exact: false })).toBeVisible();
    await shot(page, '1-sino-dashboard');
    await pop.getByRole('button', { name: 'Pagar com Pix' }).click();

    const modal = page.getByRole('dialog', { name: 'Pagar com Pix' });
    await expect(modal.getByAltText('QR Code do Pix')).toBeVisible();
    await expect(modal.getByLabel('Pix copia e cola')).toHaveValue(/^000201/);
    await expect(modal.getByText('Aguardando o pagamento')).toBeVisible();
    await shot(page, '2-modal-pix');

    await pagarNaWoovi(request, fatura._id);
    await expect(page.getByRole('dialog', { name: 'Pagamento confirmado' })).toBeVisible({ timeout: 25000 });
    await shot(page, '3-pago');
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByRole('button', { name: 'Notificações', exact: true })).toBeVisible();
    semErros(erros, '/dashboard');
  });

  test('igreja suspensa fica na Assinatura até pagar; depois volta ao normal', async ({ page, request }) => {
    test.setTimeout(60000);
    const fatura = await (await request.post(api(`/platform/tenants/${igreja._id}/invoices`), { headers: h(), data: { competencia: '2026-02' } })).json();
    expect(E2E.banco).toMatch(/_e2e$/);
    await mongoose.connect(E2E.banco);
    try {
      await mongoose.connection.collection('invoices').updateOne(
        { _id: new mongoose.Types.ObjectId(fatura._id) },
        { $set: { vencimento: new Date(Date.now() - 8 * 864e5) } },
      );
    } finally {
      await mongoose.disconnect();
    }
    await request.post(api('/platform/billing/run'), { headers: h() });

    await page.goto('/members');
    await expect(page).toHaveURL(/\/assinatura/);
    await expect(page.getByText('Acesso suspenso por fatura em atraso.')).toBeVisible();
    const card = page.getByText('Fatura em aberto', { exact: true }).locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]');
    await expect(card.getByText('Vencida')).toBeVisible();
    await shot(page, '4-assinatura-suspensa');

    await card.getByRole('button', { name: 'Pagar com Pix' }).click();
    await expect(page.getByAltText('QR Code do Pix')).toBeVisible();
    await pagarNaWoovi(request, fatura._id);
    await expect(page.getByRole('dialog', { name: 'Pagamento confirmado' })).toBeVisible({ timeout: 25000 });
    await page.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByText('Acesso suspenso por fatura em atraso.')).toHaveCount(0, { timeout: 10000 });

    await page.goto('/members');
    await expect(page).toHaveURL(/\/members/);
  });

  test('link do email: página pública /pagar/:token com a marca do PastorIA', async ({ browser, request }) => {
    const fatura = await (await request.post(api(`/platform/tenants/${igreja._id}/invoices`), { headers: h(), data: { competencia: '2026-03' } })).json();
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } }); // sem login
    const page = await ctx.newPage();
    const erros = vigiar(page);
    await page.goto(`/pagar/${fatura.publicToken}`);
    await expect(page.getByText('Fatura da assinatura')).toBeVisible();
    await expect(page.getByAltText('QR Code do Pix')).toBeVisible();
    await expect(page.getByLabel('Pix copia e cola')).toHaveValue(/^000201/);
    await shot(page, '5-pagina-publica');
    await pagarNaWoovi(request, fatura._id);
    await expect(page.getByText('Pagamento confirmado')).toBeVisible({ timeout: 25000 });
    semErros(erros, '/pagar');
    await ctx.close();
  });

  test('plataforma: cancelar fatura usa o diálogo do app e o consumo de IA aparece', async ({ browser, request }) => {
    const fatura = await (await request.post(api(`/platform/tenants/${igreja._id}/invoices`), { headers: h(), data: { competencia: '2026-04' } })).json();
    // Chamadas de IA de exemplo (a suíte roda sem IA): uma de cada provedor
    await mongoose.connect(E2E.banco);
    try {
      const tid = new mongoose.Types.ObjectId(igreja._id);
      await mongoose.connection.collection('aiusageevents').insertMany([
        { tenantId: tid, at: new Date(), provider: 'anthropic', model: 'claude-opus-5-5', modelVersion: 'claude-opus-5-5', operacao: 'agente', interacao: true, inputTokens: 10000, cachedTokens: 6000, cacheWriteTokens: 2000, outputTokens: 1000, thinkingTokens: 0, audioSegundos: 0, custoUsd: 0.0392, usdBrl: 5, custoBrl: 0.196, ms: 4200 },
        { tenantId: tid, at: new Date(), provider: 'gemini', model: 'gemini-3.8-flash', modelVersion: 'gemini-3.8-flash-001', operacao: 'texto', interacao: false, inputTokens: 9872, cachedTokens: 9378, cacheWriteTokens: 0, outputTokens: 420, thinkingTokens: 180, audioSegundos: 0, custoUsd: 0.0026, usdBrl: 5, custoBrl: 0.013, ms: 1800 },
        { tenantId: tid, at: new Date(), provider: 'openai', model: 'whisper-1', modelVersion: 'whisper-1', operacao: 'transcricao', interacao: false, inputTokens: 0, cachedTokens: 0, cacheWriteTokens: 0, outputTokens: 0, thinkingTokens: 0, audioSegundos: 90, custoUsd: 0.009, usdBrl: 5, custoBrl: 0.045, ms: 2500 },
      ]);
    } finally {
      await mongoose.disconnect();
    }
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const erros = vigiar(page);
    await page.goto('/platform/login');
    await page.evaluate(([k, t]) => localStorage.setItem(k, t), [PLATFORM_KEY, token]);
    await page.goto(`/platform/igrejas/${igreja._id}`);
    await expect(page.getByText('Consumo de IA (por chamada)')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'claude-opus-5-5' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'gemini-3.8-flash-001' }).first()).toBeVisible();
    await expect(page.getByText('1,5 min')).toBeVisible();
    const linha = page.locator('li', { hasText: '2026-04' });
    page.on('dialog', () => { throw new Error('diálogo nativo do navegador não deveria abrir'); });
    await linha.getByRole('button', { name: 'Cancelar' }).click();
    const dlg = page.getByRole('alertdialog', { name: 'Cancelar fatura' });
    await expect(dlg).toBeVisible();
    await shot(page, '6-dialogo-cancelar');
    await dlg.getByRole('button', { name: 'Cancelar fatura' }).click();
    const motivo = page.getByRole('dialog', { name: 'Motivo do cancelamento' });
    await motivo.getByRole('textbox').fill('teste e2e');
    await motivo.getByRole('button', { name: 'Confirmar cancelamento' }).click();
    await expect(page.getByText('Fatura cancelada.')).toBeVisible();
    await expect(linha.getByText('Cancelada')).toBeVisible();
    expect(fatura._id).toBeTruthy();
    await page.getByText('Consumo de IA (por chamada)').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -20));
    await shot(page, '7-consumo-ia');
    semErros(erros, '/platform/igrejas/:id');
    await ctx.close();
  });
});
