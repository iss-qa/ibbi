// Painéis e relatórios: impacto do mês (com comparativo), células, dashboard, cuidado e exportação.
const { test, expect } = require('@playwright/test');
const { cliente, diaIso } = require('../helpers');

test.describe('Painéis e relatórios', () => {
  test('impacto: mês atual x anterior, refletindo o que a suíte fez', async ({ request }) => {
    const a = await cliente(request);
    const { atual, anterior } = await (await a.get('/impacto')).json();
    expect(atual.mes).toBe(diaIso(0).slice(0, 7));
    expect(anterior.mes < atual.mes).toBe(true);
    expect(atual.checkinsCulto).toBeGreaterThanOrEqual(2);
    expect(atual.pedidosOracao).toBeGreaterThanOrEqual(2);
    expect(atual.inscricoesEventos).toBeGreaterThanOrEqual(1);
    expect(atual.horasEconomizadas).toBeGreaterThanOrEqual(0);
    // parâmetro inválido cai no mês atual
    expect((await (await a.get('/impacto', { mes: '2026-13x' })).json()).atual.mes).toBe(atual.mes);
  });

  test('células: saúde, membros e totais', async ({ request }) => {
    const a = await cliente(request);
    const { celulas, totais } = await (await a.get('/celulas/painel')).json();
    const c = celulas.find((x) => x.nome === 'Célula Teste');
    expect(c).toMatchObject({ membros: 5, congregacao: 'Sede', saude: 'parada', multiplicar: false });
    expect(c.lideres).toContain('Pastor Teste');
    expect(totais.celulas).toBe(1);
  });

  test('dashboard, cuidado e exportação CSV', async ({ request }) => {
    const a = await cliente(request);
    expect((await a.get('/dashboard')).status()).toBe(200);
    expect((await a.get('/care/overview')).status()).toBe(200);
    const csv = await a.get('/export/persons');
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain('Membro Teste');
  });

  test('membro comum não vê painéis da liderança', async ({ request }) => {
    const m = await cliente(request, { login: 'membro' });
    for (const p of ['/impacto', '/celulas/painel', '/dashboard', '/care/overview', '/export/persons', '/optout']) {
      expect((await m.get(p)).status(), p).toBe(403);
    }
  });
});
