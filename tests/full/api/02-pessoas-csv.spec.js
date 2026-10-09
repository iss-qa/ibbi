// Cadastro de pessoas: regras de negócio, duplicidade e importação CSV.
const { test, expect } = require('@playwright/test');
const { cliente, E2E } = require('../helpers');

test.describe('Pessoas', () => {
  test('cria pessoa; batizado vira membro automaticamente', async ({ request }) => {
    const a = await cliente(request);
    const res = await a.post('/persons', { nome: 'joão batizado teste', sexo: 'Masculino', celular: '(00) 00000-0301', batizado: true, tipo: 'congregado', congregacao: 'Sede', dataNascimento: '1995-04-01' });
    expect(res.status(), await res.text()).toBe(201);
    const p = await res.json();
    expect(p.tipo).toBe('membro');
    expect(p.nome).toBe('João Batizado Teste');
    expect(p.celular).toBe('00000000301');
  });

  test('inativar exige motivo', async ({ request }) => {
    const a = await cliente(request);
    const { items } = await (await a.get('/persons', { search: 'Batizado Teste' })).json();
    const semMotivo = await a.put(`/persons/${items[0]._id}`, { status: 'inativo' });
    expect(semMotivo.status()).toBeGreaterThanOrEqual(400);
    const comMotivo = await a.put(`/persons/${items[0]._id}`, { status: 'inativo', motivoInativacao: 'mudança de endereço' });
    expect(comMotivo.status(), await comMotivo.text()).toBe(200);
  });

  test('importação CSV: prévia, importação e idempotência', async ({ request }) => {
    const a = await cliente(request);
    const csv = 'nome;sexo;dataNascimento;celular;tipo;estadoCivil;batizado;congregacao\n'
      + 'Csv Um Teste;F;15/03/1985;(00) 00000-0401;membro;casada;sim;sede\n'
      + 'Csv Dois Teste;M;02/08/2010;00000000402;congregado;;não;Inexistente\n'
      + ';M;;;;;;\n';
    const enviar = (dry) => request.post(`${E2E.apiUrl}/persons/import-csv${dry ? '?dryRun=1' : ''}`, {
      headers: { Authorization: `Bearer ${a.token}` },
      multipart: { file: { name: 'pessoas.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) } },
    });
    const previa = await (await enviar(true)).json();
    expect(previa.resumo).toMatchObject({ total: 3, criados: 2, erros: 1 });
    const real = await (await enviar(false)).json();
    expect(real.resumo.criados).toBe(2);
    const deNovo = await (await enviar(false)).json();
    expect(deNovo.resumo.criados).toBe(0);
    const { items } = await (await a.get('/persons', { search: 'Csv Um' })).json();
    expect(items[0]).toMatchObject({ estadoCivil: 'casado(a)', tipo: 'membro', congregacao: 'Sede' });
  });

  test('modelo CSV para download', async ({ request }) => {
    const a = await cliente(request);
    const res = await a.get('/persons/import-template');
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/nome,sexo,dataNascimento/);
  });
});
