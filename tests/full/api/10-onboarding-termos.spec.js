// Termos de uso (aceite versionado) e onboarding guiado ("Primeiros passos").
const { test, expect } = require('@playwright/test');
const { cliente } = require('../helpers');

test.describe.serial('Termos e onboarding', () => {
  test('igreja sem aceite: termos pendentes e onboarding não pronto', async ({ request }) => {
    const a = await cliente(request);
    const t = await (await a.get('/tenant')).json();
    expect(t.termosPendentes).toBe(true);
    const o = await (await a.get('/tenant/onboarding')).json();
    expect(o.termosPendentes).toBe(true);
    expect(o.pronto).toBe(false);
    const etapa = (id) => o.etapas.find((e) => e.id === id);
    expect(etapa('termos').feito).toBe(false);
    expect(etapa('igreja').feito).toBe(true); // cidade/UF + contato do seed
    expect(etapa('lideranca').feito).toBe(true);
    expect(etapa('pessoas').feito).toBe(true); // 17 pessoas ativas
    expect(etapa('grupos').obrigatoria).toBe(false);
    expect(o.etapas.map((e) => e.id)).toEqual(expect.arrayContaining(['assistente', 'teste'])); // plano com IA
  });

  test('aceite exige o "aceito: true" e registra quem aceitou', async ({ request }) => {
    const a = await cliente(request);
    expect((await a.post('/tenant/termos/aceitar', {})).status()).toBe(400);
    const o = await (await a.post('/tenant/termos/aceitar', { aceito: true })).json();
    expect(o.termosPendentes).toBe(false);
    const t = await (await a.get('/tenant')).json();
    expect(t.termos.versao).toBe(o.termosVersao);
    expect(t.termos.aceitoPor).toBe('Pastor Teste');
  });

  test('confirmar etapa: só as confirmáveis', async ({ request }) => {
    const a = await cliente(request);
    expect((await a.post('/tenant/onboarding/confirmar', { etapa: 'whatsapp' })).status()).toBe(400);
    expect((await a.post('/tenant/onboarding/confirmar', { etapa: 'pessoas' })).status()).toBe(400);
    const o = await (await a.post('/tenant/onboarding/confirmar', { etapa: 'assistente' })).json();
    expect(o.etapas.find((e) => e.id === 'assistente').feito).toBe(true);
  });

  test('com as obrigatórias feitas o onboarding conclui sozinho', async ({ request }) => {
    const a = await cliente(request);
    await a.post('/tenant/onboarding/confirmar', { etapa: 'automacoes' });
    const o = await (await a.get('/tenant/onboarding')).json();
    const faltam = o.etapas.filter((e) => e.obrigatoria && !e.feito).map((e) => e.id);
    expect(faltam).toEqual([]);
    expect(o.pronto).toBe(true);
    expect(o.concluido).toBe(true);
  });

  test('dispensar e voltar a mostrar', async ({ request }) => {
    const a = await cliente(request);
    expect((await (await a.post('/tenant/onboarding/dispensar', {})).json()).dispensado).toBe(true);
    expect((await (await a.post('/tenant/onboarding/dispensar', { dispensar: false })).json()).dispensado).toBe(false);
  });

  test('apenas o master: admin recebe 403', async ({ request }) => {
    const adm = await cliente(request, { login: 'admin' });
    expect((await adm.get('/tenant/onboarding')).status()).toBe(403);
    expect((await adm.post('/tenant/termos/aceitar', { aceito: true })).status()).toBe(403);
  });

  test('Pix nas configurações: nome/cidade limitados ao padrão do BR Code', async ({ request }) => {
    const a = await cliente(request);
    await a.put('/tenant/settings', { pix: { chave: 'pix@e2e.test', nome: 'Igreja Com Um Nome Muito Comprido Demais', cidade: 'Cidade Com Nome Grande Demais' } });
    const t = await (await a.get('/tenant')).json();
    expect(t.pix.nome.length).toBeLessThanOrEqual(25);
    expect(t.pix.cidade.length).toBeLessThanOrEqual(15);
  });

  test('páginas públicas de termos e privacidade existem no front', async ({ request }) => {
    for (const p of ['/termos', '/privacidade']) expect((await request.get(p)).status()).toBe(200);
  });
});
