// @ts-check
/**
 * Testes de fluxo completo de comunicação WhatsApp
 *
 * Testa os cenários reais:
 * 1. Cadastrar novo decidido → recebe boas-vindas + grupo notificado
 * 2. Cadastrar visitante → recebe boas-vindas + grupo notificado
 * 3. Grupo do Projeto Amigo recebe notificação com dados do cadastrado
 *
 * TODAS as mensagens são enviadas para MOCK_PHONE (71996838735)
 * para não disparar para membros reais.
 */
const { test, expect } = require('@playwright/test');
const { authHeaders, API_URL } = require('../helpers/auth');
const { MOCK_PHONE, timestamp } = require('../helpers/test-data');

let headers;
const cleanupIds = { persons: [], groups: [] };

test.beforeAll(async ({ request }) => {
  headers = await authHeaders(request);
});

// Cleanup after all tests
test.afterAll(async ({ request }) => {
  for (const id of cleanupIds.persons) {
    try { await request.delete(`${API_URL}/persons/${id}`, { headers }); } catch { /* */ }
  }
  for (const id of cleanupIds.groups) {
    try { await request.delete(`${API_URL}/triagem-grupos/${id}`, { headers }); } catch { /* */ }
  }
});

test.describe('Fluxo: Novo Decidido → WhatsApp', () => {
  let grupoId;
  const ts = timestamp();

  test('1. Criar grupo de Novos Decididos com Juntix Silva', async ({ request }) => {
    // Create group
    const res = await request.post(`${API_URL}/triagem-grupos`, {
      headers,
      data: {
        nome: `Teste Novos Decididos ${ts}`,
        tipo: 'novos_decididos',
        congregacao: 'Sede',
        descricao: 'Grupo de teste automatizado',
      },
    });
    expect(res.status()).toBe(201);
    const grupo = await res.json();
    grupoId = grupo._id;
    cleanupIds.groups.push(grupoId);

    // Find Juntix Silva
    const searchRes = await request.get(`${API_URL}/persons?search=Juntix&limit=1`, { headers });
    const searchBody = await searchRes.json();

    if (searchBody.items?.length > 0) {
      const juntix = searchBody.items[0];
      // Add Juntix to group
      const addRes = await request.post(`${API_URL}/triagem-grupos/${grupoId}/membros`, {
        headers,
        data: { membro_id: juntix._id },
      });
      // May fail if different congregation - that's ok
      if (addRes.ok()) {
        console.log(`[TEST] Juntix Silva added to group`);
      }
    }

    // Also add a fake member with MOCK_PHONE to receive notifications
    const fakeMember = await request.post(`${API_URL}/persons`, {
      headers,
      data: {
        nome: `Amigo Teste ${ts}`,
        tipo: 'membro',
        congregacao: 'Sede',
        celular: MOCK_PHONE,
        dataNascimento: '1990-01-01',
        sexo: 'Masculino',
        status: 'ativo',
      },
    });
    if (fakeMember.ok()) {
      const fakeBody = await fakeMember.json();
      cleanupIds.persons.push(fakeBody._id);

      // Add fake member to group
      await request.post(`${API_URL}/triagem-grupos/${grupoId}/membros`, {
        headers,
        data: { membro_id: fakeBody._id },
      });
    }
  });

  test('2. Cadastrar novo decidido → deve disparar boas-vindas + notificar grupo', async ({ request }) => {
    // Create a novo decidido with MOCK_PHONE
    const res = await request.post(`${API_URL}/persons`, {
      headers,
      data: {
        nome: `Novo Decidido Teste ${ts}`,
        tipo: 'novo decidido',
        congregacao: 'Sede',
        celular: MOCK_PHONE,
        dataDecisao: new Date().toISOString().split('T')[0],
        sexo: 'Masculino',
        status: 'ativo',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.tipo).toBe('novo decidido');
    cleanupIds.persons.push(body._id);

    // Wait for async trigger to process
    await new Promise((r) => setTimeout(r, 5000));

    // Verify messages were logged
    const logRes = await request.get(`${API_URL}/messages/log`, { headers });
    const logs = await logRes.json();

    // Should find a novo_decidido message in recent logs
    const recentDecididoMsg = logs.find(
      (m) => m.tipo === 'novo_decidido' && m.origemNome?.includes('Novo Decidido Teste')
    );
    expect(recentDecididoMsg).toBeTruthy();
    expect(recentDecididoMsg.status).toBe('concluido');

    console.log('[TEST] Novo decidido messages found in log:',
      logs.filter((m) => m.origemNome?.includes('Novo Decidido Teste')).length
    );
  });

  test('3. Verificar que o novo decidido foi adicionado aos acompanhados do grupo', async ({ request }) => {
    if (!grupoId) test.skip();

    const res = await request.get(`${API_URL}/triagem-grupos/${grupoId}`, { headers });
    expect(res.status()).toBe(200);
    const grupo = await res.json();

    const acomp = grupo.acompanhados?.find((a) => a.nome?.includes('Novo Decidido Teste'));
    expect(acomp).toBeTruthy();
    expect(acomp.tipo).toBe('novo decidido');
    console.log(`[TEST] Novo decidido found in acompanhados: ${acomp.nome}`);
  });
});

test.describe('Fluxo: Visitante → WhatsApp', () => {
  let grupoId;
  const ts = timestamp();

  test('1. Criar grupo de Visitantes', async ({ request }) => {
    const res = await request.post(`${API_URL}/triagem-grupos`, {
      headers,
      data: {
        nome: `Teste Visitantes ${ts}`,
        tipo: 'visitantes',
        congregacao: 'Sede',
        descricao: 'Grupo de teste automatizado visitantes',
      },
    });
    expect(res.status()).toBe(201);
    const grupo = await res.json();
    grupoId = grupo._id;
    cleanupIds.groups.push(grupoId);

    // Add fake member with MOCK_PHONE
    const fakeMember = await request.post(`${API_URL}/persons`, {
      headers,
      data: {
        nome: `Amigo Visitante Teste ${ts}`,
        tipo: 'membro',
        congregacao: 'Sede',
        celular: MOCK_PHONE,
        dataNascimento: '1985-06-15',
        sexo: 'Feminino',
        status: 'ativo',
      },
    });
    if (fakeMember.ok()) {
      const fakeBody = await fakeMember.json();
      cleanupIds.persons.push(fakeBody._id);

      await request.post(`${API_URL}/triagem-grupos/${grupoId}/membros`, {
        headers,
        data: { membro_id: fakeBody._id },
      });
    }
  });

  test('2. Cadastrar visitante → deve disparar boas-vindas + notificar grupo', async ({ request }) => {
    const res = await request.post(`${API_URL}/persons`, {
      headers,
      data: {
        nome: `Visitante Teste ${ts}`,
        tipo: 'visitante',
        congregacao: 'Sede',
        celular: MOCK_PHONE,
        dataVisita: new Date().toISOString().split('T')[0],
        sexo: 'Feminino',
        status: 'ativo',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.tipo).toBe('visitante');
    cleanupIds.persons.push(body._id);

    // Wait for async trigger
    await new Promise((r) => setTimeout(r, 5000));

    // Verify messages were logged
    const logRes = await request.get(`${API_URL}/messages/log`, { headers });
    const logs = await logRes.json();

    const recentVisitanteMsg = logs.find(
      (m) => m.tipo === 'visitante' && m.origemNome?.includes('Visitante Teste')
    );
    expect(recentVisitanteMsg).toBeTruthy();
    expect(recentVisitanteMsg.status).toBe('concluido');

    console.log('[TEST] Visitante messages found in log:',
      logs.filter((m) => m.origemNome?.includes('Visitante Teste')).length
    );
  });

  test('3. Verificar que o visitante foi adicionado aos acompanhados do grupo', async ({ request }) => {
    if (!grupoId) test.skip();

    const res = await request.get(`${API_URL}/triagem-grupos/${grupoId}`, { headers });
    expect(res.status()).toBe(200);
    const grupo = await res.json();

    const acomp = grupo.acompanhados?.find((a) => a.nome?.includes('Visitante Teste'));
    expect(acomp).toBeTruthy();
    expect(acomp.tipo).toBe('visitante');
    console.log(`[TEST] Visitante found in acompanhados: ${acomp.nome}`);
  });
});
