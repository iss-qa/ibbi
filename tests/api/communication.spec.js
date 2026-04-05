// @ts-check
const { test, expect } = require('@playwright/test');
const { authHeaders, API_URL } = require('../helpers/auth');

let headers;

test.beforeAll(async ({ request }) => {
  headers = await authHeaders(request);
});

test.describe('Communication API - Happy Path', () => {
  test('should get message log', async ({ request }) => {
    const res = await request.get(`${API_URL}/messages/log`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
  });

  test('should get message summary stats', async ({ request }) => {
    const res = await request.get(`${API_URL}/messages/summary`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('concluido');
    expect(body).toHaveProperty('enviando');
    expect(body).toHaveProperty('erro');
  });

  test('should get prayer log', async ({ request }) => {
    const res = await request.get(`${API_URL}/messages/prayer-log`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
  });

  test('should get queue status', async ({ request }) => {
    const res = await request.get(`${API_URL}/messages/queue-status`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('pendente');
  });

  test('should reject send without required fields', async ({ request }) => {
    const res = await request.post(`${API_URL}/messages/send-individual`, {
      headers,
      data: { celular: '', mensagem: '' },
    });

    // Should fail validation
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe('Dashboard API', () => {
  test('should get main dashboard', async ({ request }) => {
    const res = await request.get(`${API_URL}/dashboard`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('ativos');
    expect(body).toHaveProperty('aniversariantes');
  });

  test('should get projeto amigo dashboard', async ({ request }) => {
    const res = await request.get(`${API_URL}/projeto-amigo/dashboard`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('visitantesMes');
    expect(body).toHaveProperty('decididosMes');
    expect(body).toHaveProperty('emAcompanhamento');
    expect(body).toHaveProperty('grupos');
  });
});

test.describe('Triagem Groups API', () => {
  let groupId;

  test('should list triagem groups', async ({ request }) => {
    const res = await request.get(`${API_URL}/triagem-grupos`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
    if (body.length > 0) {
      groupId = body[0]._id;
    }
  });

  test('should get group detail with activities', async ({ request }) => {
    if (!groupId) test.skip();

    const res = await request.get(`${API_URL}/triagem-grupos/${groupId}`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('nome');
    expect(body).toHaveProperty('membros');
    expect(body).toHaveProperty('atividades');
    expect(body).toHaveProperty('acompanhados');
  });
});
