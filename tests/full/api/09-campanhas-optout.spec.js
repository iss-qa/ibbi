// Campanhas graduais (sermão, avisos): público, descadastrados excluídos, validações e cancelamento.
const { test, expect } = require('@playwright/test');
const { cliente } = require('../helpers');

test.describe.serial('Campanhas', () => {
  let campanha;

  test('prévia do público: total = recebem + descadastrados; SAIR registrado pela liderança sai do público', async ({ request }) => {
    const a = await cliente(request);
    const antes = await (await a.get('/campanhas/publico')).json();
    expect(antes.total).toBe(antes.recebem + antes.descadastrados);
    const reg = await a.post('/optout', { celular: '00000000205', motivo: 'Pediu por telefone para não receber' });
    expect([200, 201]).toContain(reg.status());
    const depois = await (await a.get('/campanhas/publico')).json();
    expect(depois.descadastrados).toBe(antes.descadastrados + 1);
    expect(depois.recebem).toBe(antes.recebem - 1);
  });

  test('filtro por tipo e congregação', async ({ request }) => {
    const a = await cliente(request);
    const norte = await (await a.get('/campanhas/publico', { congregacao: 'Norte' })).json();
    const todos = await (await a.get('/campanhas/publico')).json();
    expect(norte.total).toBeGreaterThan(0);
    expect(norte.total).toBeLessThan(todos.total);
    const visitantes = await (await a.get('/campanhas/publico', { tipos: 'visitante' })).json();
    expect(visitantes.total).toBeLessThan(todos.total);
  });

  test('validações de criação', async ({ request }) => {
    const a = await cliente(request);
    expect((await a.post('/campanhas', { titulo: 'x' })).status()).toBe(400);
    expect((await a.post('/campanhas', { titulo: 'x', texto: 'a'.repeat(3600) })).status()).toBe(400);
    expect((await a.post('/campanhas', { titulo: 'x', texto: 'oi', enviarApos: 'ontem' })).status()).toBe(400);
    expect((await a.post('/campanhas/sermao/organizar', { relato: 'curto' })).status()).toBe(400);
  });

  test('cria campanha agendada para amanhã com o descadastrado marcado como bloqueado', async ({ request }) => {
    const a = await cliente(request);
    const amanha = new Date(Date.now() + 864e5).toISOString();
    const r = await a.post('/campanhas', { titulo: 'Aviso E2E', texto: 'Domingo teremos ceia.', enviarApos: amanha });
    expect(r.status()).toBe(201);
    campanha = await r.json();
    expect(campanha.status).toBe('agendada');
    expect(campanha.bloqueados).toBeGreaterThanOrEqual(1);
    expect(campanha.enviados).toBe(0);
    const lista = await (await a.get('/campanhas')).json();
    expect(lista.find((c) => c.id === campanha.id)).toBeTruthy();
  });

  test('cancelar; cancelar de novo dá 400', async ({ request }) => {
    const a = await cliente(request);
    const c = await (await a.post(`/campanhas/${campanha.id}/cancelar`)).json();
    expect(c.status).toBe('cancelada');
    expect((await a.post(`/campanhas/${campanha.id}/cancelar`)).status()).toBe(400);
  });

  test('membro comum não cria campanhas', async ({ request }) => {
    const m = await cliente(request, { login: 'membro' });
    expect((await m.post('/campanhas', { titulo: 'x', texto: 'y' })).status()).toBe(403);
  });
});
