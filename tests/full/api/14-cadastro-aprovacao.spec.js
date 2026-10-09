// Cadastro pelo link público + aprovação: data de batismo é opcional e nunca impede o fluxo.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { cliente, E2E } = require('../helpers');

// Mesmo objeto que o MemberForm externo envia (initialState + o que a pessoa preencheu)
const formulario = (extra) => ({
  nome: '', sexo: '', dataNascimento: '', email: '', celular: '', tipo: 'congregado', grupo: '', estadoCivil: '',
  batizado: false, dataBatismo: '', dataCasamento: '', congregacao: 'Sede', status: 'ativo', motivoInativacao: '',
  endereco: '', ministerio: '', fotoUrl: '', dataVisita: '', dataDecisao: '',
  ...extra,
});

// Mesmo personData que RegistrationApprovals.jsx manda no PUT /approve
const personDataDaTela = (req) => {
  const raw = { ...(req.submittedData || {}) };
  const hasBaptism = Boolean(raw.batizado || raw.dataBatismo);
  return { ...raw, nome: raw.nome || req.nome, celular: raw.celular || req.celular, congregacao: raw.congregacao || req.congregacao, batizado: hasBaptism, tipo: hasBaptism ? 'membro' : raw.tipo };
};

const CASOS = [
  { titulo: 'congregado viúvo(a), sem batismo', fone: '00000001401', dados: { sexo: 'Feminino', dataNascimento: '1962-04-10', estadoCivil: 'viúvo(a)' } },
  { titulo: 'batizado sem data de batismo', fone: '00000001402', dados: { tipo: 'membro', batizado: true, dataNascimento: '1990-01-20' } },
  { titulo: 'data de batismo impossível (13º mês)', fone: '00000001403', dados: { tipo: 'membro', batizado: true, dataBatismo: '2020-13-45' } },
  { titulo: 'data de casamento inválida', fone: '00000001404', dados: { estadoCivil: 'casado(a)', dataCasamento: '31/02/2010' } },
  { titulo: 'aprovado por admin (não master)', fone: '00000001405', dados: { tipo: 'membro', batizado: true }, aprovador: 'admin' },
  { titulo: 'datas digitadas dd/mm/aaaa', fone: '00000001406', dados: { tipo: 'membro', batizado: true, dataNascimento: '02/03/1960', dataBatismo: '28/05/2006' }, salvo: { dataNascimento: '1960-03-02', dataBatismo: '2006-05-28' } },
];

test.describe('Cadastro externo e aprovação', () => {
  let token;
  test.beforeAll(async ({ request }) => {
    const master = await cliente(request);
    const res = await master.post('/invitations', {});
    expect(res.status(), await res.text()).toBe(200);
    ({ token } = await res.json());
  });

  for (const caso of CASOS) {
    test(`envia e aprova: ${caso.titulo}`, async ({ request }) => {
      const nome = `Aprovacao ${caso.fone.slice(-3)} Teste`;
      const envio = await request.post(`${E2E.apiUrl}/public/invitations/${token}/submit`, {
        data: formulario({ nome, celular: caso.fone, ...caso.dados }),
      });
      expect(envio.status(), await envio.text()).toBe(200);

      const lider = await cliente(request, caso.aprovador ? { login: caso.aprovador } : undefined);
      const { items } = await (await lider.get('/registrations', { status: 'pending', search: nome })).json();
      expect(items).toHaveLength(1);

      const aprovar = await lider.put(`/registrations/${items[0]._id}/approve`, { personData: personDataDaTela(items[0]) });
      expect(aprovar.status(), await aprovar.text()).toBe(200);
      const { person, avisos } = await aprovar.json();
      expect(person.nome).toBe(nome);
      if (caso.dados.batizado) expect(person.tipo).toBe('membro');
      // Data opcional que não dá para entender é descartada já no envio: a aprovação chega limpa
      expect(avisos).toEqual([]);
      if (/impossível|inválida/.test(caso.titulo)) {
        expect(person.dataBatismo).toBeUndefined();
        expect(person.dataCasamento).toBeUndefined();
      }
      for (const [campo, dia] of Object.entries(caso.salvo || {})) expect(String(person[campo]).slice(0, 10)).toBe(dia);
    });
  }

  test('pedido antigo salvo com data ruim é aprovado com aviso', async ({ request }) => {
    const nome = 'Pedido Antigo Teste';
    const envio = await request.post(`${E2E.apiUrl}/public/invitations/${token}/submit`, { data: formulario({ nome, celular: '00000001409' }) });
    expect(envio.status()).toBe(200);
    const master = await cliente(request);
    const { items } = await (await master.get('/registrations', { status: 'pending', search: nome })).json();
    // a tela manda o submittedData; pedidos de antes da correção trazem a data crua (ex.: digitada como texto)
    const personData = { ...personDataDaTela(items[0]), batizado: true, dataBatismo: '2020-13-45' };
    const aprovar = await master.put(`/registrations/${items[0]._id}/approve`, { personData });
    expect(aprovar.status(), await aprovar.text()).toBe(200);
    const { person, avisos } = await aprovar.json();
    expect(person.tipo).toBe('membro');
    expect(person.dataBatismo).toBeUndefined();
    expect(avisos).toEqual([expect.stringMatching(/batismo/i)]);
  });

  test('foto do link público: sem IA configurada a verificação não trava o envio', async ({ request }) => {
    const buffer = fs.readFileSync(path.join(__dirname, '../../../frontend/src/assets/logo-ibbi.jpeg'));
    const res = await request.post(`${E2E.apiUrl}/uploads/person-photo/public`, {
      multipart: { file: { name: 'foto.jpg', mimeType: 'image/jpeg', buffer } },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).url).toMatch(/^data:image\/jpeg;base64,/);
  });

  test('data de nascimento inválida volta para a pessoa corrigir', async ({ request }) => {
    const envio = await request.post(`${E2E.apiUrl}/public/invitations/${token}/submit`, {
      data: formulario({ nome: 'Nascimento Errado Teste', celular: '00000001407', dataNascimento: '45/13/1990' }),
    });
    expect(envio.status()).toBe(400);
    expect((await envio.json()).message).toMatch(/nascimento/i);
  });

  test('cadastro interno com data impossível responde 400 com o campo', async ({ request }) => {
    const master = await cliente(request);
    const res = await master.post('/persons', { nome: 'Data Impossivel Teste', celular: '00000001408', congregacao: 'Sede', batizado: true, dataBatismo: '2020-13-45' });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toMatch(/batismo/i);
  });
});

test.describe('Configurações da igreja', () => {
  test('programação semanal salva e volta no GET /tenant', async ({ request }) => {
    const master = await cliente(request);
    const programacao = '🟡 *Domingo — 09:00 | EBD*\n🟡 *Quarta — 19:30 | Estudo bíblico*\nRua das Flores, 120';
    const salvar = await master.put('/tenant/settings', { programacaoSemanal: programacao });
    expect(salvar.status(), await salvar.text()).toBe(200);
    const tenant = await (await master.get('/tenant')).json();
    expect(tenant.programacaoSemanal).toBe(programacao);
  });
});
