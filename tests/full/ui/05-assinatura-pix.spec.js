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
});
