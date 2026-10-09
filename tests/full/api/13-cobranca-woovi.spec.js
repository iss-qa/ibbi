// Cobrança da assinatura via Woovi (Woovi falsa no mock): fatura com Pix, troca de plano com
// reajuste, webhook (conta compartilhada, assinatura, baixa conferida na API), suspensão após
// 7 dias de atraso e liberação automática com o pagamento.
const { test, expect } = require('@playwright/test');
const mongoose = require('mongoose');
const { E2E, cliente } = require('../helpers');

const api = (p) => `${E2E.apiUrl}${p}`;
const mock = (p) => `${E2E.mockUrl}${p}`;

test.describe.serial('Cobrança Woovi', () => {
  let plataforma;
  let semente;
  let fatura;
  const igreja = (request) => cliente(request, { igreja: E2E.igrejas.semente });
  const h = () => ({ Authorization: `Bearer ${plataforma}` });

  // Webhook como a Woovi envia: corpo bruto assinado (RSA) ou com o Authorization do painel.
  const webhook = async (request, body, { assinar = true, authorization } = {}) => {
    const raw = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json' };
    if (assinar) headers['x-webhook-signature'] = (await (await request.post(mock('/__woovi/sign'), { data: raw, headers: { 'Content-Type': 'text/plain' } })).json()).signature;
    if (authorization) headers.Authorization = authorization;
    return request.post(api('/webhooks/openpix'), { data: raw, headers });
  };
  const cobrancas = async (request) => (await request.get(mock('/__woovi/charges'))).json();
  const faturaAtual = async (request) => (await (await (await igreja(request)).get('/tenant/billing')).json()).faturas.find((f) => f._id === fatura._id);

  test.beforeAll(async ({ request }) => {
    const r = await request.post(api('/platform/auth/login'), { data: { email: 'plataforma@e2e.test', senha: 'Plataforma@E2e123' } });
    plataforma = (await r.json()).token;
    const lista = await (await request.get(api('/platform/tenants'), { headers: h() })).json();
    semente = lista.find((t) => t.slug === E2E.igrejas.semente);
  });

  test.afterAll(async ({ request }) => {
    // Volta a igreja de teste para isenta (não interfere nos testes de UI)
    await request.put(api(`/platform/tenants/${semente._id}`), { headers: h(), data: { billing: { isento: true } } });
  });

  test('fatura gerada já sai com Pix na Woovi (prefixo pastoria-)', async ({ request }) => {
    expect((await request.put(api(`/platform/tenants/${semente._id}`), { headers: h(), data: { billing: { isento: false } } })).status()).toBe(200);
    const r = await request.post(api(`/platform/tenants/${semente._id}/invoices`), { headers: h(), data: {} });
    expect(r.status()).toBe(201);
    fatura = await r.json();
    expect(fatura.valor).toBe(47);
    expect(fatura.gateway).toMatchObject({ provider: 'woovi', status: 'ACTIVE', valor: 47 });
    expect(fatura.gateway.id).toMatch(new RegExp(`^pastoria-${fatura._id}-1-`));
    const c = (await cobrancas(request)).find((x) => x.correlationID === fatura.gateway.id);
    expect(c).toMatchObject({ value: 4700, type: 'DYNAMIC' });
    expect(c.customer).toMatchObject({ name: 'Igreja Semente E2E', email: `${E2E.igrejas.semente}@e2e.test` });
    expect(c.comment).not.toMatch(/—/); // a Woovi recusa símbolos tipográficos no comentário
  });

  test('igreja vê a fatura no aviso do painel e gera o QR do Pix', async ({ request }) => {
    const master = await igreja(request);
    const t = await (await master.get('/tenant')).json();
    expect(t.faturaAberta).toMatchObject({ _id: fatura._id, valor: 47, status: 'pendente', abertas: 1 });
    const b = await (await master.get('/tenant/billing')).json();
    expect(b.politica).toMatchObject({ suspendAfterDays: 7, gateway: 'woovi' });
    expect(b.faturas[0].pix.invoiceUrl).toContain('woovi.example/pay/');
    expect(b.faturas[0].gateway).toBeUndefined(); // ids internos não saem para a igreja
    const pix = await (await master.post(`/tenant/billing/faturas/${fatura._id}/pix`)).json();
    expect(pix.pago).toBe(false);
    expect(pix.pix.brCode).toMatch(/^000201/);
    expect(pix.pix.qrCode).toMatch(/^data:image\/png;base64,/);
  });

  test('link público /pagar/:token mostra o Pix sem login; token inválido dá 404', async ({ request }) => {
    expect(fatura.publicToken).toMatch(/^[A-Za-z0-9_-]{20,40}$/);
    const r = await request.get(api(`/public/faturas/${fatura.publicToken}`));
    expect(r.status()).toBe(200);
    const pub = await r.json();
    expect(pub).toMatchObject({ igreja: 'Igreja Semente E2E', valor: 47, status: 'pendente' });
    expect(pub.pix.brCode).toMatch(/^000201/);
    expect(pub.pix.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(pub).not.toHaveProperty('gateway');
    expect(pub).not.toHaveProperty('tenantId');
    expect((await request.get(api('/public/faturas/token-que-nao-existe-123456'))).status()).toBe(404);
    expect((await request.get(api('/public/faturas/x'))).status()).toBe(404);
  });

  test('outra igreja não acessa a fatura', async ({ request }) => {
    const a = await cliente(request);
    expect((await a.get(`/tenant/billing/faturas/${fatura._id}`)).status()).toBe(404);
    expect((await a.post(`/tenant/billing/faturas/${fatura._id}/pix`)).status()).toBe(404);
  });

  test('upgrade Semente → Crescer reajusta a fatura e troca o Pix', async ({ request }) => {
    const master = await igreja(request);
    const antigo = fatura.gateway.id;
    const r = await master.put('/tenant/billing/plan', { plano: 'crescer', ciclo: 'mensal' });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.plano).toBe('crescer');
    expect(body.faturasReajustadas).toEqual([expect.objectContaining({ _id: fatura._id, valor: 99 })]);
    const lista = await cobrancas(request);
    expect(lista.find((c) => c.correlationID === antigo)).toBeUndefined(); // Pix antigo removido
    const novo = lista.find((c) => c.correlationID.startsWith(`pastoria-${fatura._id}-2-`));
    expect(novo).toMatchObject({ value: 9900, status: 'ACTIVE' });
    const f = await faturaAtual(request);
    expect(f).toMatchObject({ valor: 99, plano: 'crescer', status: 'pendente' });
    expect(f.observacao).toMatch(/Reajustada de R\$ 47,00 para R\$ 99,00/);
    fatura = { ...fatura, correlationID: novo.correlationID };
  });

  test('webhook: cobrança de outro produto da conta é ignorada; sem assinatura é recusado', async ({ request }) => {
    const outro = await webhook(request, { event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: 'juntix-123', status: 'COMPLETED' } }, { assinar: false });
    expect(outro.status()).toBe(200);
    expect((await outro.json()).ignored).toBe(true);
    const teste = await webhook(request, { evento: 'teste_webhook' }, { assinar: false });
    expect(teste.status()).toBe(200);
    const semAss = await webhook(request, { event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: fatura.correlationID, status: 'COMPLETED' } }, { assinar: false, authorization: 'errado' });
    expect(semAss.status()).toBe(401);
  });

  test('webhook dizendo "pago" não dá baixa se a Woovi diz que não foi pago', async ({ request }) => {
    const r = await webhook(request, { event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: fatura.correlationID, status: 'COMPLETED', value: 9900 } }, { authorization: 'segredo-webhook-e2e' });
    expect(r.status()).toBe(200);
    expect((await faturaAtual(request)).status).toBe('pendente');
  });

  test('Pix pago → webhook assinado dá baixa (uma vez só)', async ({ request }) => {
    const master = await igreja(request);
    await request.post(mock(`/__woovi/pay/${encodeURIComponent(fatura.correlationID)}`));
    const body = { event: 'OPENPIX:CHARGE_COMPLETED', charge: { correlationID: fatura.correlationID, status: 'COMPLETED', value: 9900 } };
    expect((await webhook(request, body)).status()).toBe(200);
    // TRANSACTION_RECEIVED do mesmo Pix chega logo depois: idempotente
    expect((await webhook(request, { event: 'OPENPIX:TRANSACTION_RECEIVED', pix: { charge: { correlationID: fatura.correlationID } } })).status()).toBe(200);
    const f = await faturaAtual(request);
    expect(f).toMatchObject({ status: 'pago', valorPago: 99, metodo: 'pix' });
    expect(f.pix).toBeNull();
    expect((await (await master.get('/tenant')).json()).faturaAberta).toBeNull();
    expect((await (await request.get(api(`/public/faturas/${fatura.publicToken}`))).json()).status).toBe('pago');
  });

  test('plataforma cancela a fatura: o Pix sai da Woovi e o link público mostra cancelada', async ({ request }) => {
    const r = await request.post(api(`/platform/tenants/${semente._id}/invoices`), { headers: h(), data: { competencia: '2025-12' } });
    const extra = await r.json();
    const corr = extra.gateway.id;
    expect((await request.put(api(`/platform/invoices/${extra._id}/cancel`), { headers: h(), data: { observacao: 'cortesia' } })).status()).toBe(200);
    expect((await cobrancas(request)).find((c) => c.correlationID === corr)).toBeUndefined();
    const pub = await (await request.get(api(`/public/faturas/${extra.publicToken}`))).json();
    expect(pub).toMatchObject({ status: 'cancelado', pix: null });
  });

  test('consumo de IA por chamada: endpoint da plataforma responde com modelo e cotação', async ({ request }) => {
    const r = await request.get(api('/platform/ia-uso'), { headers: h(), params: { tenantId: semente._id } });
    expect(r.status()).toBe(200);
    const d = await r.json();
    expect(d.periodo).toMatch(/^\d{4}-\d{2}$/);
    expect(d.cotacao.valor).toBeGreaterThan(1);
    expect(Array.isArray(d.porModelo) && Array.isArray(d.ultimas)).toBe(true);
    expect((await request.get(api('/platform/ia-uso'), { headers: h(), params: { tenantId: 'x' } })).status()).toBe(400);
    const igreja = await cliente(request, { igreja: E2E.igrejas.semente });
    expect((await request.get(api('/platform/ia-uso'), { headers: { Authorization: `Bearer ${igreja.token}` } })).status()).toBe(401);
  });

  test('7 dias de atraso suspendem; Assinatura continua liberada; pagar libera na hora', async ({ request }) => {
    const master = await igreja(request);
    const r = await request.post(api(`/platform/tenants/${semente._id}/invoices`), { headers: h(), data: { competencia: '2026-01' } });
    expect(r.status()).toBe(201);
    const atrasada = await r.json();
    expect(E2E.banco).toMatch(/_e2e$/);
    await mongoose.connect(E2E.banco);
    try {
      // Vencimento 8 dias atrás (a API não deixa criar fatura vencida)
      await mongoose.connection.collection('invoices').updateOne(
        { _id: new mongoose.Types.ObjectId(atrasada._id) },
        { $set: { vencimento: new Date(Date.now() - 8 * 864e5) } },
      );
    } finally {
      await mongoose.disconnect();
    }
    const ciclo = await (await request.post(api('/platform/billing/run'), { headers: h() })).json();
    expect(ciclo.suspensas).toBeGreaterThanOrEqual(1);

    const bloqueado = await master.get('/persons');
    expect(bloqueado.status()).toBe(402);
    expect((await bloqueado.json()).code).toBe('TENANT_SUSPENDED');
    const t = await (await master.get('/tenant')).json();
    expect(t.status).toBe('suspensa');
    expect(t.faturaAberta).toMatchObject({ _id: atrasada._id, status: 'vencido' });
    expect(t.faturaAberta.diasAtraso).toBeGreaterThanOrEqual(7);
    expect((await master.get('/tenant/billing')).status()).toBe(200);

    const pix = await (await master.post(`/tenant/billing/faturas/${atrasada._id}/pix`)).json();
    expect(pix.pix.brCode).toBeTruthy();
    const corr = (await cobrancas(request)).find((c) => c.correlationID.startsWith(`pastoria-${atrasada._id}-`)).correlationID;
    await request.post(mock(`/__woovi/pay/${encodeURIComponent(corr)}`));
    // Sem webhook: a tela consulta a fatura e a conferência direta na Woovi dá a baixa
    // (a conferência é feita no máximo a cada 10s por fatura, como na tela, que consulta em intervalos)
    let st;
    await expect.poll(async () => {
      st = await (await master.get(`/tenant/billing/faturas/${atrasada._id}`)).json();
      return st.fatura.status;
    }, { timeout: 20000, intervals: [2000] }).toBe('pago');
    expect(st.tenantStatus).toBe('ativa');
    expect((await master.get('/persons')).status()).toBe(200);
  });
});
