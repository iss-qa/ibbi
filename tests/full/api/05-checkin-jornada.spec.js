// Presença no culto por QR (CHEGUEI) e jornada do visitante.
const { test, expect } = require('@playwright/test');
const { E2E, cliente, conversar, whats, esperarMsg, ultimoSeq } = require('../helpers');

test.describe.serial('Culto: check-in e jornada', () => {
  let culto;

  test('liderança abre o check-in de hoje (QR + link wa.me)', async ({ request }) => {
    const a = await cliente(request);
    const res = await a.post('/cultos', { congregacao: 'Sede', titulo: 'Culto E2E' });
    expect([200, 201]).toContain(res.status());
    culto = await res.json();
    expect(culto.codigo).toMatch(/^[A-Z0-9]{5}$/);
    expect(culto.link).toBe(`https://wa.me/55${E2E.fones.bot}?text=CHEGUEI%20${culto.codigo}`);
    expect(culto.qr).toMatch(/^data:image\/png;base64,/);
  });

  test('reabrir no mesmo dia reaproveita o mesmo culto', async ({ request }) => {
    const a = await cliente(request);
    const de = await (await a.post('/cultos', { congregacao: 'Sede' })).json();
    expect(de.id).toBe(culto.id);
  });

  test('membro conhecido: CHEGUEI confirma; repetido avisa', async ({ request }) => {
    await conversar(request, E2E.fones.admin, `cheguei ${culto.codigo}`, /Presença confirmada/);
    await conversar(request, E2E.fones.admin, `CHEGUEI ${culto.codigo}`, /já está registrada/);
  });

  test('código inválido', async ({ request }) => {
    await conversar(request, E2E.fones.admin, 'cheguei ZZZZZ', /Não encontrei esse culto/);
  });

  test('número desconhecido: pede nome → vira visitante → boas-vindas + jornada', async ({ request }) => {
    const N = E2E.fones.desconhecido;
    await conversar(request, N, `cheguei ${culto.codigo}`, /nome completo/);
    await conversar(request, N, 'Carlos', /nome e sobrenome/);
    const desde = await ultimoSeq(request);
    await whats(request, N, 'Carlos Visitante Teste');
    await esperarMsg(request, N, /Que alegria ter você aqui/, { desde });
    await esperarMsg(request, N, /Shalom, Carlos Visitante Teste|Que alegria ter você conosco/, { desde, timeout: 20000 });
    const a = await cliente(request);
    const { jornadas } = await (await a.get('/jornadas')).json();
    const j = jornadas.find((x) => x.nome === 'Carlos Visitante Teste');
    expect(j).toBeTruthy();
    expect(j.tipo).toBe('visitante');
    expect(j.etapas.map((e) => e.chave)).toEqual(['d1', 'd2', 'd3', 'd7', 'd14', 'd21', 'd30']);
  });

  test('presenças do culto (2 check-ins: 1 visitante) e presença manual', async ({ request }) => {
    const a = await cliente(request);
    const det = await (await a.get(`/cultos/${culto.id}`)).json();
    expect(det.presentes).toBe(2);
    expect(det.visitantes).toBe(1);
    const { items } = await (await a.get('/persons', { search: 'Pessoa Extra B' })).json();
    const depois = await (await a.post(`/cultos/${culto.id}/presencas`, { personId: items[0]._id })).json();
    expect(depois.presentes).toBe(3);
  });

  test('encerrar o check-in: CHEGUEI deixa de valer', async ({ request }) => {
    const a = await cliente(request);
    await a.post(`/cultos/${culto.id}/encerrar`);
    await conversar(request, E2E.fones.lider, `cheguei ${culto.codigo}`, /Não encontrei esse culto/);
  });
});
