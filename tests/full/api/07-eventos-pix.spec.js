// Eventos com inscrição pelo WhatsApp, Pix copia-e-cola (CRC válido), lista de espera e pagamento.
const { test, expect } = require('@playwright/test');
const { E2E, cliente, conversar, esperarMsg, ultimoSeq, caixa, diaIso } = require('../helpers');

// CRC16/CCITT-FALSE independente da implementação do backend
const crc16 = (s) => {
  let crc = 0xffff;
  for (const b of Buffer.from(s, 'utf8')) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};
const pixValido = (p) => p.startsWith('000201') && crc16(p.slice(0, -4)) === p.slice(-4);

test.describe.serial('Eventos e inscrições', () => {
  let pago;
  let gratis;

  test('validação e criação (pago com 1 vaga e gratuito)', async ({ request }) => {
    const a = await cliente(request);
    expect((await a.post('/eventos', { data: diaIso(10) })).status()).toBe(400);
    const r1 = await a.post('/eventos', { titulo: 'Retiro E2E', data: diaIso(10), horario: '08:00', local: 'Chácara', valor: 25.5, vagas: 1 });
    expect(r1.status()).toBe(201);
    pago = await r1.json();
    expect(pago.codigo).toMatch(/^[A-Z0-9]{4,8}$/);
    gratis = await (await a.post('/eventos', { titulo: 'Culto Jovem E2E', data: diaIso(9) })).json();
    const { eventos, pixConfigurado } = await (await a.get('/eventos')).json();
    expect(pixConfigurado).toBe(true);
    expect(eventos.map((e) => e.titulo)).toEqual(expect.arrayContaining(['Retiro E2E', 'Culto Jovem E2E']));
  });

  test('prévia do Pix: BR Code com chave, valor e CRC16 válidos', async ({ request }) => {
    const a = await cliente(request);
    const { pix } = await (await a.get(`/eventos/${pago.id}/pix`)).json();
    expect(pixValido(pix.copiaECola)).toBe(true);
    expect(pix.copiaECola).toContain('pix@e2e.test');
    expect(pix.copiaECola).toContain('540525.50'); // campo 54 = valor
    expect(pix.qr).toMatch(/^data:image\/png;base64,/);
    const g = await (await a.get(`/eventos/${gratis.id}/pix`)).json();
    expect(g.pix).toBeNull();
    expect(g.motivo).toMatch(/gratuito/i);
  });

  test('INSCREVER pelo WhatsApp: confirmação + Pix copia-e-cola + QR', async ({ request }) => {
    const desde = await ultimoSeq(request);
    const r = await conversar(request, E2E.fones.membro, `INSCREVER ${pago.codigo}`, /Inscrição confirmada/);
    expect(r.text).toMatch(/Retiro E2E/);
    expect(r.text).toMatch(/R\$ 25,50/);
    const cc = await esperarMsg(request, E2E.fones.membro, /^000201/, { desde });
    expect(pixValido(cc.text)).toBe(true);
    await expect.poll(async () => (await caixa(request, E2E.fones.membro)).some((m) => m.seq > desde && m.media)).toBe(true);
  });

  test('inscrição repetida e código inválido', async ({ request }) => {
    await conversar(request, E2E.fones.membro, `inscrever ${pago.codigo}`, /já está inscrito/);
    await conversar(request, E2E.fones.membro, 'INSCREVER ZZZZ9', /Não encontrei esse evento/);
  });

  test('sem vagas → lista de espera', async ({ request }) => {
    await conversar(request, E2E.fones.admin, `INSCREVER ${pago.codigo}`, /lista de espera/);
  });

  test('número desconhecido: pede o nome antes de inscrever (evento gratuito)', async ({ request }) => {
    const novo = '00000000098'; // número que nunca falou com a igreja
    await conversar(request, novo, `INSCREVER ${gratis.codigo}`, /nome completo/);
    await conversar(request, novo, 'Bia', /nome e sobrenome/);
    const r = await conversar(request, novo, 'Beatriz Nova Teste', /Inscrição confirmada/);
    expect(r.text).not.toMatch(/Pix/);
  });

  test('líder confirma pagamento → aviso; cancela → vaga vai para a espera', async ({ request }) => {
    const a = await cliente(request);
    const det = await (await a.get(`/eventos/${pago.id}`)).json();
    const membro = det.inscricoes.find((i) => i.nome === 'Membro Teste');
    const espera = det.inscricoes.find((i) => i.nome === 'Admin Teste');
    expect(espera.status).toBe('espera');
    let desde = await ultimoSeq(request);
    expect((await a.put(`/eventos/${pago.id}/inscricoes/${membro._id}`, { status: 'pago' })).status()).toBe(200);
    await esperarMsg(request, E2E.fones.membro, /recebemos o seu pagamento/, { desde });
    expect((await a.put(`/eventos/${pago.id}/inscricoes/${membro._id}`, { status: 'xpto' })).status()).toBe(400);
    desde = await ultimoSeq(request);
    await a.put(`/eventos/${pago.id}/inscricoes/${membro._id}`, { status: 'cancelado' });
    await esperarMsg(request, E2E.fones.admin, /abriu uma vaga em \*Retiro E2E\*/, { desde });
    const depois = await (await a.get(`/eventos/${pago.id}`)).json();
    expect(depois.inscricoes.find((i) => i.nome === 'Admin Teste').status).toBe('inscrito');
  });

  test('inscrição pela web e divulgação vira campanha gradual', async ({ request }) => {
    const a = await cliente(request);
    const r = await a.post(`/eventos/${gratis.id}/inscricoes`, { nome: 'Inscrito Web' });
    expect(r.status()).toBe(201);
    const c = await (await a.post(`/eventos/${gratis.id}/divulgar`, {})).json();
    expect(c.titulo).toMatch(/Divulgação: Culto Jovem E2E/);
    expect(c.total).toBeGreaterThan(5);
  });

  test('menu 15 no WhatsApp lista os eventos', async ({ request }) => {
    await conversar(request, E2E.fones.lider, 'menu', /O que você quer fazer/);
    const r = await conversar(request, E2E.fones.lider, '15', /Próximos eventos/);
    expect(r.text).toContain(pago.codigo);
  });
});

test.describe.serial('Evento pago com recebedor (líder/departamento)', () => {
  let evento;
  const fone = '00000001410';

  test('chave Pix do líder é validada pelo tipo', async ({ request }) => {
    const a = await cliente(request);
    const base = { titulo: 'Acampamento E2E', data: diaIso(12), valor: 80 };
    const invalida = await a.post('/eventos', { ...base, recebedor: { tipo: 'lider', nome: 'João Tesoureiro', chaveTipo: 'cpf', chave: '123' } });
    expect(invalida.status()).toBe(400);
    expect((await invalida.json()).message).toMatch(/Chave Pix inválida/);
    const ok = await a.post('/eventos', { ...base, recebedor: { tipo: 'lider', nome: 'João Tesoureiro', departamento: 'Tesouraria dos Jovens', chaveTipo: 'celular', chave: '(71) 99999-8888' } });
    expect(ok.status(), await ok.text()).toBe(201);
    evento = await ok.json();
    expect(evento.recebedor).toMatchObject({ tipo: 'lider', texto: 'João Tesoureiro · Tesouraria dos Jovens' });
  });

  test('Pix vai para a chave do líder', async ({ request }) => {
    const a = await cliente(request);
    const { pix } = await (await a.get(`/eventos/${evento.id}/pix`)).json();
    expect(pixValido(pix.copiaECola)).toBe(true);
    expect(pix.copiaECola).toContain('+5571999998888');
    expect(pix.copiaECola).toContain('JOAO TESOUREIRO');
    expect(pix.copiaECola).not.toContain('pix@e2e.test');
  });

  test('inscrição pelo WhatsApp informa quem recebe', async ({ request }) => {
    await conversar(request, fone, `INSCREVER ${evento.codigo}`, /nome completo/);
    const r = await conversar(request, fone, 'Carla Recebedor Teste', /Inscrição confirmada/);
    expect(r.text).toMatch(/Pagamento para: \*João Tesoureiro · Tesouraria dos Jovens\*/);
  });

  test('switch Pago: liga e desliga, registrando quem marcou', async ({ request }) => {
    const a = await cliente(request);
    const insc = (await (await a.get(`/eventos/${evento.id}`)).json()).inscricoes.find((i) => i.nome === 'Carla Recebedor Teste');
    await a.put(`/eventos/${evento.id}/inscricoes/${insc._id}`, { status: 'pago' });
    let det = await (await a.get(`/eventos/${evento.id}`)).json();
    let i = det.inscricoes.find((x) => x._id === insc._id);
    expect(i.status).toBe('pago');
    expect(i.confirmadoPor).toBeTruthy();
    expect(det.pagos).toBe(1);
    await a.put(`/eventos/${evento.id}/inscricoes/${insc._id}`, { status: 'inscrito' });
    det = await (await a.get(`/eventos/${evento.id}`)).json();
    i = det.inscricoes.find((x) => x._id === insc._id);
    expect(i.status).toBe('inscrito');
    expect(i.confirmadoPor).toBeUndefined();
    expect(det.pagos).toBe(0);
  });
});
