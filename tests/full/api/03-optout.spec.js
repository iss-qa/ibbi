// Descadastro "SAIR": depois do SAIR, NADA sai para o número até "VOLTAR".
const { test, expect } = require('@playwright/test');
const { E2E, cliente, whats, conversar, esperarMsg, nadaChega, ultimoSeq } = require('../helpers');

const NUM = E2E.fones.membro;

test.describe.serial('Descadastro (SAIR / VOLTAR)', () => {
  test('SAIR → uma única mensagem de confirmação', async ({ request }) => {
    const msg = await conversar(request, NUM, 'Sair', /não vai mais receber/i);
    expect(msg.text).toMatch(/VOLTAR/);
    await nadaChega(request, NUM, msg.seq);
  });

  test('número descadastrado aparece na lista da liderança', async ({ request }) => {
    const a = await cliente(request);
    const lista = await (await a.get('/optout')).json();
    expect(lista.some((o) => o.chave === NUM && o.ativo)).toBe(true);
  });

  test('descadastrado escrevendo (oi, menu, check-in) não recebe resposta', async ({ request }) => {
    const desde = await ultimoSeq(request);
    for (const t of ['oi', 'menu', 'CHEGUEI ABCDE', 'INSCREVER XYZ12']) await whats(request, NUM, t);
    await nadaChega(request, NUM, desde, 3000);
  });

  test('aviso de grupo e campanha não chegam ao descadastrado', async ({ request }) => {
    const a = await cliente(request);
    const previa = await (await a.get('/campanhas/publico', { congregacao: 'Sede', tipos: 'membro' })).json();
    expect(previa.descadastrados).toBeGreaterThanOrEqual(1);
  });

  test('reativar pela liderança exige justificativa', async ({ request }) => {
    const a = await cliente(request);
    const lista = await (await a.get('/optout')).json();
    const reg = lista.find((o) => o.chave === NUM);
    expect((await a.post(`/optout/${reg._id}/reativar`, { justificativa: 'curta' })).status()).toBe(400);
  });

  test('VOLTAR reativa e volta a receber', async ({ request }) => {
    const msg = await conversar(request, NUM, 'voltar', /de volta/i);
    expect(msg.text).toMatch(/SAIR/);
    const desde = await ultimoSeq(request);
    await whats(request, NUM, 'menu');
    await esperarMsg(request, NUM, /./, { desde });
  });

  test('"cancelar" e "vou sair mais cedo" NÃO descadastram', async ({ request }) => {
    for (const t of ['cancelar', 'vou sair mais cedo do culto']) {
      const desde = await ultimoSeq(request);
      await whats(request, NUM, t);
      const m = await esperarMsg(request, NUM, /./, { desde });
      expect(m.text).not.toMatch(/não vai mais receber/i);
    }
  });
});
