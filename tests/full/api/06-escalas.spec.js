// Escalas de voluntários: convite pelo WhatsApp, recusa, substituto sugerido e confirmação.
const { test, expect } = require('@playwright/test');
const { E2E, cliente, conversar, esperarMsg, ultimoSeq, diaIso, LOTE } = require('../helpers');

test.describe.serial('Escalas', () => {
  test.setTimeout(180000);
  let escalaId;
  let ids;

  test.beforeAll(async ({ request }) => {
    const a = await cliente(request);
    const { items } = await (await a.get('/persons', { limit: 100 })).json();
    ids = Object.fromEntries(items.map((p) => [p.nome, p._id]));
  });

  test('validações: ministério/data, horário e pessoas obrigatórias', async ({ request }) => {
    const a = await cliente(request);
    expect((await a.post('/escalas', { data: diaIso(5) })).status()).toBe(400);
    expect((await a.post('/escalas', { ministerio: 'Louvor', data: diaIso(5), horario: '25:00', itens: [] })).status()).toBe(400);
    expect((await a.post('/escalas', { ministerio: 'Louvor', data: diaIso(5), itens: [] })).status()).toBe(400);
  });

  test('cria a escala e o convite chega ao voluntário', async ({ request }) => {
    const a = await cliente(request);
    const desde = await ultimoSeq(request);
    const res = await a.post('/escalas', {
      ministerio: 'Vocais', evento: 'Culto de domingo', congregacao: 'Sede', data: diaIso(6), horario: '18:00', enviar: true,
      itens: [{ funcao: 'Vocal', personId: ids['Voluntario Teste'] }],
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    escalaId = body.escala._id;
    expect(body.enviados).toBe(1);
    const convite = await esperarMsg(request, E2E.fones.voluntario, /Você foi escalado\(a\) para servir/, { desde, ...LOTE });
    expect(convite.text).toMatch(/Vocais\* · Vocal/);
    expect(convite.text).toMatch(/1\. ✅ Confirmo/);
  });

  test('voluntário recusa ("2 viagem") → líder recebe sugestão de substituto', async ({ request }) => {
    const desde = await ultimoSeq(request);
    await conversar(request, E2E.fones.voluntario, '2 viagem', /Tudo bem, Voluntario/);
    const aviso = await esperarMsg(request, E2E.fones.lider, /não pode servir como \*Vocal\*/, { desde });
    expect(aviso.text).toMatch(/viagem/);
    expect(aviso.text).toMatch(/1\. Substituta Teste/);
  });

  test('líder escolhe o substituto (1) → convite → substituta confirma → líder é avisado', async ({ request }) => {
    const desde = await ultimoSeq(request);
    await conversar(request, E2E.fones.lider, '1', /Convite enviado para \*Substituta Teste\*/);
    await esperarMsg(request, E2E.fones.substituto, /Você foi escalado\(a\) para servir/, { desde, ...LOTE });
    const d2 = await ultimoSeq(request);
    await conversar(request, E2E.fones.substituto, 'confirmo', /Confirmado, Substituta/);
    await esperarMsg(request, E2E.fones.lider, /\*Substituta Teste\* confirmou/, { desde: d2 });
  });

  test('situação final da escala e sugestões', async ({ request }) => {
    const a = await cliente(request);
    const lista = await (await a.get('/escalas')).json();
    const e = lista.find((x) => x._id === escalaId);
    const vol = e.itens.find((i) => i.nome === 'Voluntario Teste');
    const sub = e.itens.find((i) => i.nome === 'Substituta Teste');
    expect(vol.status).toBe('recusado');
    expect(vol.motivoRecusa).toMatch(/viagem/);
    expect(sub.status).toBe('confirmado');
    expect(sub.substituiu).toBe('Voluntario Teste');
    expect(Array.isArray(await (await a.get(`/escalas/${escalaId}/sugestoes`)).json())).toBe(true);
  });

  test('cancelar remove da lista', async ({ request }) => {
    const a = await cliente(request);
    expect((await a.del(`/escalas/${escalaId}`)).status()).toBe(200);
    const lista = await (await a.get('/escalas')).json();
    expect(lista.find((x) => x._id === escalaId)).toBeFalsy();
  });

  test('membro comum não acessa escalas', async ({ request }) => {
    const m = await cliente(request, { login: 'membro' });
    expect((await m.get('/escalas')).status()).toBe(403);
  });
});
