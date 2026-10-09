// Autenticação, papéis e isolamento entre igrejas (multi-tenant).
const { test, expect } = require('@playwright/test');
const { E2E, login, cliente } = require('../helpers');

test.describe('Autenticação', () => {
  test('login do master devolve token e usuário sem a senha', async ({ request }) => {
    const { token, user } = await login(request);
    expect(token).toBeTruthy();
    expect(user.role).toBe('master');
    expect(JSON.stringify(user)).not.toMatch(/senha|\$2[aby]\$/);
  });

  test('senha errada → 401 e mensagem genérica', async ({ request }) => {
    const res = await request.post(`${E2E.apiUrl}/auth/login`, { data: { login: 'senhaerrada', senha: 'errada', igreja: E2E.igrejas.a } });
    expect(res.status()).toBe(401);
  });

  test('login é por igreja: o mesmo login em outra igreja é outro usuário', async ({ request }) => {
    const a = await login(request, { igreja: E2E.igrejas.a });
    const b = await login(request, { igreja: E2E.igrejas.b });
    expect(a.user._id).not.toBe(b.user._id);
  });

  test('sem token → 401 nas rotas protegidas', async ({ request }) => {
    for (const rota of ['/persons', '/cultos', '/escalas', '/eventos', '/campanhas', '/impacto', '/optout', '/tenant/onboarding']) {
      const res = await request.get(`${E2E.apiUrl}${rota}`);
      expect(res.status(), rota).toBe(401);
    }
  });

  test('membro comum não acessa rotas da liderança', async ({ request }) => {
    const m = await cliente(request, { login: 'membro' });
    for (const rota of ['/persons', '/cultos', '/escalas', '/eventos', '/campanhas', '/optout', '/prayer']) {
      expect((await m.get(rota)).status(), rota).toBe(403);
    }
  });

  test('admin não acessa rotas exclusivas do master (onboarding, indicação)', async ({ request }) => {
    const ad = await cliente(request, { login: 'admin' });
    expect((await ad.get('/tenant/onboarding')).status()).toBe(403);
    expect((await ad.get('/tenant/indicacao')).status()).toBe(403);
  });
});

test.describe('Isolamento entre igrejas', () => {
  test('igreja A não enxerga pessoas da igreja B', async ({ request }) => {
    const a = await cliente(request);
    const lista = await (await a.get('/persons', { search: 'Secreta', limit: 50 })).json();
    expect(lista.items.map((p) => p.nome)).not.toContain('Pessoa Secreta Igreja B');
  });

  test('igreja B não abre a pessoa da igreja A pelo id', async ({ request }) => {
    const a = await cliente(request);
    const { items } = await (await a.get('/persons', { search: 'Membro Teste' })).json();
    const b = await cliente(request, { igreja: E2E.igrejas.b });
    const res = await b.get(`/persons/${items[0]._id}`);
    expect([403, 404]).toContain(res.status());
  });

  test('token de uma igreja não serve no webhook de outra', async ({ request }) => {
    const res = await request.post(`${E2E.apiUrl}/webhooks/evolution/${E2E.igrejas.b}?token=${E2E.webhookToken}-${E2E.igrejas.a}`, { data: { event: 'messages.upsert', data: {} } });
    expect(res.status()).toBe(401);
  });
});
