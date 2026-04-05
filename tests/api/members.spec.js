// @ts-check
const { test, expect } = require('@playwright/test');
const { authHeaders, API_URL } = require('../helpers/auth');
const { newMember, newVisitante, newNovoDecidido } = require('../helpers/test-data');

let headers;
let createdIds = [];

test.beforeAll(async ({ request }) => {
  headers = await authHeaders(request);
});

test.afterAll(async ({ request }) => {
  for (const id of createdIds) {
    try { await request.delete(`${API_URL}/persons/${id}`, { headers }); } catch { /* ignore */ }
  }
});

test.describe('Members API - CRUD Happy Path', () => {
  let firstCreatedId;

  test('should create a new congregado member', async ({ request }) => {
    const member = newMember();
    const res = await request.post(`${API_URL}/persons`, { headers, data: member });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body._id).toBeTruthy();
    expect(body.tipo).toBe('congregado');
    expect(body.congregacao).toBe('Sede');
    firstCreatedId = body._id;
    createdIds.push(body._id);
  });

  test('should create a visitante with dataVisita', async ({ request }) => {
    const visitante = newVisitante();
    const res = await request.post(`${API_URL}/persons`, { headers, data: visitante });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.tipo).toBe('visitante');
    expect(body.dataVisita).toBeTruthy();
    createdIds.push(body._id);
  });

  test('should create a novo decidido with dataDecisao', async ({ request }) => {
    const decidido = newNovoDecidido();
    const res = await request.post(`${API_URL}/persons`, { headers, data: decidido });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.tipo).toBe('novo decidido');
    expect(body.dataDecisao).toBeTruthy();
    createdIds.push(body._id);
  });

  test('should list members with pagination', async ({ request }) => {
    const res = await request.get(`${API_URL}/persons?page=1&limit=5`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items).toBeInstanceOf(Array);
    expect(body.total).toBeGreaterThan(0);
    expect(body.page).toBe(1);
    expect(body.items.length).toBeLessThanOrEqual(5);
  });

  test('should search members by name', async ({ request }) => {
    const res = await request.get(`${API_URL}/persons?search=Teste+Automatizado&limit=5`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].nome.toLowerCase()).toContain('teste');
  });

  test('should get member by id', async ({ request }) => {
    expect(firstCreatedId).toBeTruthy();
    const res = await request.get(`${API_URL}/persons/${firstCreatedId}`, { headers });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body._id).toBe(firstCreatedId);
  });

  test('should update member', async ({ request }) => {
    expect(firstCreatedId).toBeTruthy();
    const res = await request.put(`${API_URL}/persons/${firstCreatedId}`, {
      headers,
      data: { endereco: 'Rua Teste 123, Salvador-BA' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.endereco).toBe('Rua Teste 123, Salvador-BA');
  });

  test('should normalize member name on create (capitalize)', async ({ request }) => {
    const member = newMember({ nome: 'maria de souza silva' });
    const res = await request.post(`${API_URL}/persons`, { headers, data: member });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.nome).toBe('Maria de Souza Silva');
    createdIds.push(body._id);
  });

  test('should normalize UPPERCASE name on create', async ({ request }) => {
    const member = newMember({ nome: 'JOAO DOS SANTOS PEREIRA' });
    const res = await request.post(`${API_URL}/persons`, { headers, data: member });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.nome).toBe('Joao dos Santos Pereira');
    createdIds.push(body._id);
  });

  test('should reject duplicate member (same name + celular)', async ({ request }) => {
    const member = newMember({ nome: 'Duplicata Teste Unico' });
    const res1 = await request.post(`${API_URL}/persons`, { headers, data: member });
    expect(res1.status()).toBe(201);
    createdIds.push((await res1.json())._id);

    const res2 = await request.post(`${API_URL}/persons`, { headers, data: member });
    expect(res2.status()).toBe(409);
    const body = await res2.json();
    expect(body.code).toBe('DUPLICATE');
  });

  test('should delete member', async ({ request }) => {
    const member = newMember({ nome: 'Para Deletar Teste' });
    const createRes = await request.post(`${API_URL}/persons`, { headers, data: member });
    const { _id } = await createRes.json();

    const res = await request.delete(`${API_URL}/persons/${_id}`, { headers });
    expect(res.status()).toBe(200);
  });
});
