// Pedidos de oração (confidencial por padrão), rede de intercessores e lembretes de culto (opt-in).
const { test, expect } = require('@playwright/test');
const { E2E, cliente, conversar, esperarMsg, ultimoSeq, nadaChega, LOTE } = require('../helpers');

const INTERCESSOR = '00000000203'; // Pessoa Extra D Teste (Sede)

test.describe.serial('Oração e intercessores', () => {
  test.setTimeout(150000);
  let pedidoId;

  test('marcar intercessor e listar', async ({ request }) => {
    const a = await cliente(request);
    const { items } = await (await a.get('/persons', { search: 'Pessoa Extra D' })).json();
    const r = await (await a.put(`/intercessores/${items[0]._id}`, { intercessor: true })).json();
    expect(r.intercessor).toBe(true);
    const lista = await (await a.get('/intercessores')).json();
    expect(lista.map((p) => p.nome)).toContain('Pessoa Extra D Teste');
  });

  test('pedido confidencial (padrão) NÃO vai para os intercessores', async ({ request }) => {
    const adm = await cliente(request, { login: 'admin' });
    const desde = await ultimoSeq(request);
    expect((await adm.post('/prayer/send', { mensagem: 'Pedido sigiloso do admin' })).status()).toBe(200);
    await nadaChega(request, INTERCESSOR, desde, 3000);
  });

  test('pedido compartilhado: intercessor recebe só o primeiro nome; solicitante recebe confirmação', async ({ request }) => {
    const m = await cliente(request, { login: 'membro' });
    const desde = await ultimoSeq(request);
    expect((await m.post('/prayer/send', { mensagem: 'Pela cirurgia da minha mãe', confidencial: false })).status()).toBe(200);
    const aviso = await esperarMsg(request, INTERCESSOR, /Pedido de oração/, { desde, ...LOTE });
    expect(aviso.text).toMatch(/\*Membro\* pede oração/);
    expect(aviso.text).not.toContain('Membro Teste');
    expect(aviso.text).toContain('Pela cirurgia da minha mãe');
    await esperarMsg(request, E2E.fones.membro, /1 intercessor está orando por você/, { desde, ...LOTE });
  });

  test('segundo pedido em menos de 1h é recusado (429)', async ({ request }) => {
    const m = await cliente(request, { login: 'membro' });
    expect((await m.post('/prayer/send', { mensagem: 'Outro pedido' })).status()).toBe(429);
  });

  test('liderança lista, vê a flag confidencial e marca como orado', async ({ request }) => {
    const a = await cliente(request);
    const { pedidos } = await (await a.get('/prayer')).json();
    const sig = pedidos.find((p) => /sigiloso/.test(p.texto));
    const pub = pedidos.find((p) => /cirurgia/.test(p.texto));
    expect(sig.confidencial).toBe(true);
    expect(pub.confidencial).toBe(false);
    pedidoId = pub._id || pub.id;
    expect((await a.put(`/prayer/${pedidoId}/status`, { status: 'xpto' })).status()).toBe(400);
    const ok = await a.put(`/prayer/${pedidoId}/status`, { status: 'orado' });
    expect(ok.status()).toBe(200);
  });

  test('membro comum não lista pedidos', async ({ request }) => {
    const m = await cliente(request, { login: 'membro' });
    expect((await m.get('/prayer')).status()).toBe(403);
    expect((await m.get('/intercessores')).status()).toBe(403);
  });
});

test.describe.serial('Lembretes de culto (opt-in pelo WhatsApp)', () => {
  test('LEMBRETE ativa; PARAR LEMBRETE desativa', async ({ request }) => {
    await conversar(request, E2E.fones.membro, 'LEMBRETE', /lembrete antes dos cultos/);
    const a = await cliente(request);
    const { items } = await (await a.get('/persons', { search: 'Membro Teste' })).json();
    expect((await (await a.get(`/persons/${items[0]._id}`)).json()).lembreteCulto).toBe(true);
    await conversar(request, E2E.fones.membro, 'parar lembrete', /Lembretes de culto desativados/);
    expect((await (await a.get(`/persons/${items[0]._id}`)).json()).lembreteCulto).toBe(false);
  });

  test('número sem cadastro é orientado', async ({ request }) => {
    await conversar(request, '00000000097', 'lembrete', /primeiro precisamos do seu cadastro/);
  });

  test('agenda de cultos: validação e gravação nas configurações', async ({ request }) => {
    const a = await cliente(request);
    // Itens inválidos (dia 9, hora 25:00) são descartados
    await a.put('/tenant/settings', { cultosProgramados: [{ titulo: 'X', diaSemana: 9, horario: '19:00' }, { titulo: 'Y', diaSemana: 1, horario: '25:00' }] });
    expect((await (await a.get('/tenant')).json()).cultosProgramados).toHaveLength(0);
    const ok = await a.put('/tenant/settings', { cultosProgramados: [{ titulo: 'Culto da Família', diaSemana: 0, horario: '18:00', liveUrl: 'https://youtube.com/@igreja', ativo: true }] });
    expect(ok.status()).toBe(200);
    const t = await (await a.get('/tenant')).json();
    expect(t.cultosProgramados[0]).toMatchObject({ titulo: 'Culto da Família', diaSemana: 0, horario: '18:00' });
  });
});
