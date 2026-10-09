// Cadastro público com indicação, slugs reservados, demonstração somente leitura, planos e plataforma.
const { test, expect } = require('@playwright/test');
const { E2E, cliente, whats, conversar, esperarMsg, ultimoSeq, nadaChega } = require('../helpers');

const api = (p) => `${E2E.apiUrl}${p}`;

test.describe.serial('Cadastro público e indicação', () => {
  let nova;

  test('catálogo de planos com os preços novos', async ({ request }) => {
    const planos = await (await request.get(api('/public/plans'))).json();
    const preco = Object.fromEntries(planos.map((p) => [p.id, p.precoMensal]));
    expect(preco).toMatchObject({ semente: 47, crescer: 99, multiplicar: 197 });
    expect(planos.find((p) => p.id === 'rede').sobConsulta).toBe(true);
  });

  test('slug reservado e slug existente não estão disponíveis', async ({ request }) => {
    for (const s of ['demo', 'admin', E2E.igrejas.a]) {
      const r = await (await request.get(api(`/public/signup/slug/${s}`))).json();
      expect(r.disponivel, s).toBe(false);
    }
  });

  test('validações: termos obrigatórios e email', async ({ request }) => {
    const base = { nome: 'Igreja Nova E2E', responsavel: 'Pr. Novo', email: 'novo@e2e.test', celular: '71900000000' };
    expect((await request.post(api('/public/signup'), { data: base })).status()).toBe(400);
    expect((await request.post(api('/public/signup'), { data: { ...base, aceite: true, email: 'x' } })).status()).toBe(400);
  });

  test('cadastro com ?ref ganha +7 dias de teste e registra o aceite dos termos', async ({ request }) => {
    const r = await request.post(api('/public/signup'), { data: { nome: 'Igreja Indicada E2E', responsavel: 'Pr. Indicado', email: 'indicada@e2e.test', celular: '71900000001', cidade: 'Salvador', uf: 'BA', aceite: true, ref: E2E.igrejas.a, plano: 'crescer' } });
    expect(r.status()).toBe(201);
    nova = await r.json();
    expect(nova.senhaTemporaria).toBeTruthy();
    const dias = (new Date(nova.trialEndsAt) - Date.now()) / 864e5;
    expect(dias).toBeGreaterThan(20); // 14 + 7
    const a = await cliente(request);
    const ind = await (await a.get('/tenant/indicacao')).json();
    expect(ind.codigo).toBe(E2E.igrejas.a);
    expect(ind.indicadas).toBe(1);
    expect(ind.link).toContain(`ref=${E2E.igrejas.a}`);
  });

  test('1º login da igreja nova exige trocar a senha', async ({ request }) => {
    const l = await request.post(api('/auth/login'), { data: { login: nova.login, senha: nova.senhaTemporaria, igreja: nova.igreja.slug } });
    expect(l.status()).toBe(200);
    const { token, user } = await l.json();
    expect(user.mustChangePassword).toBe(true);
    const bloqueado = await request.get(api('/persons'), { headers: { Authorization: `Bearer ${token}` } });
    expect(bloqueado.status()).toBe(403);
  });
});

test.describe.serial('Plataforma (admin do SaaS)', () => {
  let token;
  const h = () => ({ Authorization: `Bearer ${token}` });

  test('login da plataforma; token de igreja não serve', async ({ request }) => {
    expect((await request.post(api('/platform/auth/login'), { data: { email: 'plataforma@e2e.test', senha: 'errada' } })).status()).toBe(401);
    const r = await request.post(api('/platform/auth/login'), { data: { email: 'plataforma@e2e.test', senha: 'Plataforma@E2e123' } });
    expect(r.status()).toBe(200);
    ({ token } = await r.json());
    const igreja = await cliente(request);
    expect((await request.get(api('/platform/tenants'), { headers: { Authorization: `Bearer ${igreja.token}` } })).status()).toBe(401);
  });

  test('lista de igrejas traz uso e custo de IA; métricas respondem', async ({ request }) => {
    const lista = await (await request.get(api('/platform/tenants'), { headers: h() })).json();
    const a = lista.find((t) => t.slug === E2E.igrejas.a);
    expect(a).toMatchObject({ plano: 'multiplicar', isento: true });
    expect(a).toHaveProperty('iaCustoMes');
    expect(a.pessoasAtivas).toBeGreaterThan(10);
    expect((await request.get(api('/platform/metrics'), { headers: h() })).status()).toBe(200);
  });

  test('indicação: 1ª fatura paga da indicada dá 1 mês de crédito a quem indicou (uma vez só)', async ({ request }) => {
    const lista = await (await request.get(api('/platform/tenants'), { headers: h() })).json();
    const ind = lista.find((t) => t.nome === 'Igreja Indicada E2E');
    const fat = await request.post(api(`/platform/tenants/${ind._id}/invoices`), { headers: h(), data: {} });
    expect([200, 201]).toContain(fat.status());
    const invoice = await fat.json();
    expect(invoice.valor).toBe(99);
    const pago = await request.put(api(`/platform/invoices/${invoice._id}/pay`), { headers: h(), data: { valorPago: 99, metodo: 'pix' } });
    expect(pago.status()).toBe(200);
    const a = await cliente(request);
    await expect.poll(async () => (await (await a.get('/tenant/indicacao')).json()).creditosMeses).toBe(1);
    // pagar de novo não concede outro mês
    await request.put(api(`/platform/invoices/${invoice._id}/pay`), { headers: h(), data: { valorPago: 99, metodo: 'pix' } });
    expect((await (await a.get('/tenant/indicacao')).json()).creditosMeses).toBe(1);
  });
});

test.describe.serial('Demonstração (somente leitura)', () => {
  let token;
  test('POST /public/demo gera token e a igreja demo tem dados', async ({ request }) => {
    const r = await request.post(api('/public/demo'));
    expect(r.status()).toBe(200);
    ({ token } = await r.json());
    const pessoas = await (await request.get(api('/persons'), { headers: { Authorization: `Bearer ${token}` } })).json();
    expect(pessoas.total).toBeGreaterThan(30);
    expect(pessoas.items.every((p) => !p.celular || p.celular.startsWith('000'))).toBe(true);
  });

  test('qualquer escrita é bloqueada com 403 DEMO_READONLY', async ({ request }) => {
    const h = { Authorization: `Bearer ${token}` };
    const r1 = await request.post(api('/persons'), { headers: h, data: { nome: 'Invasor', celular: '71999999999' } });
    expect(r1.status()).toBe(403);
    expect((await r1.json()).code).toBe('DEMO_READONLY');
    expect((await request.put(api('/tenant/settings'), { headers: h, data: { nome: 'x' } })).status()).toBe(403);
    expect((await request.post(api('/campanhas'), { headers: h, data: { titulo: 'x', texto: 'y' } })).status()).toBe(403);
  });

  test('a demo não vaza dados das outras igrejas', async ({ request }) => {
    const r = await (await request.get(api('/persons'), { headers: { Authorization: `Bearer ${token}` }, params: { search: 'Pastor Teste' } })).json();
    expect(r.items).toHaveLength(0);
  });
});

test.describe.serial('Recursos por plano', () => {
  test('Semente: sem assistente de IA (web e WhatsApp), mas check-in e escalas funcionam', async ({ request }) => {
    const s = await cliente(request, { igreja: E2E.igrejas.semente });
    expect((await s.post('/assistant/chat', { message: 'oi' })).status()).toBe(403);
    const desde = await ultimoSeq(request);
    await whats(request, '00000000600', 'menu', { igreja: E2E.igrejas.semente });
    await nadaChega(request, '00000000600', desde, 2500);
    const culto = await (await s.post('/cultos', { congregacao: 'Sede' })).json();
    await conversar(request, '00000000600', `cheguei ${culto.codigo}`, /Presença confirmada/, { igreja: E2E.igrejas.semente });
    expect((await s.get('/escalas')).status()).toBe(200);
  });

  test('Crescer: áudio do líder recebe a explicação de upgrade para o Multiplicar', async ({ request }) => {
    const desde = await ultimoSeq(request);
    await whats(request, '00000000500', '', { igreja: E2E.igrejas.b, media: { kind: 'audio', mimetype: 'audio/ogg', seconds: 5, base64: 'AAAA' } });
    const m = await esperarMsg(request, '00000000500', /não estão disponíveis no plano \*Crescer\*/, { desde });
    expect(m.text).toMatch(/Multiplicar/);
  });
});
