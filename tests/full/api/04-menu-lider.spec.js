// Menu guiado do líder no WhatsApp (sem IA): cada opção principal.
const { test, expect } = require('@playwright/test');
const { E2E, conversar } = require('../helpers');

const L = E2E.fones.lider;
const menu = (request) => conversar(request, L, 'menu', /O que você quer fazer/);

test.describe.serial('Menu do líder no WhatsApp', () => {
  test('saudação com apresentação bíblica do assistente e as 16 opções', async ({ request }) => {
    const m = await menu(request);
    expect(m.text).toMatch(/Sou \*Barnabé\*: acolhi Paulo/);
    for (const op of ['Pesquisar pessoa', 'Registrar presença', 'Resumir um encontro', 'Quem está faltando', 'Pedidos de oração', 'Escalas de voluntários', 'Resumo do sermão', 'Eventos e inscrições', 'Impacto do mês']) expect(m.text).toContain(op);
    expect(m.text).toMatch(/plataforma web/);
  });

  test('MENU em maiúsculas abre o menu no meio de outro fluxo', async ({ request }) => {
    await menu(request);
    await conversar(request, L, '1', /nome/);
    const m = await conversar(request, L, 'MENU', /O que você quer fazer/);
    expect(m).toBeTruthy();
  });

  test('1 → pesquisa → ficha completa com opções', async ({ request }) => {
    await menu(request);
    await conversar(request, L, '1', /nome/);
    const f = await conversar(request, L, 'voluntario', /Voluntario Teste/);
    expect(f.text).toMatch(/Status:.*Ativo/);
    expect(f.text).toMatch(/Congregação:\* Sede/);
    expect(f.text).toMatch(/1\. Editar dados/);
  });

  test('4 → 3 culto: abre o check-in e manda o QR para o líder', async ({ request }) => {
    await menu(request);
    await conversar(request, L, '4', /Onde foi o encontro/);
    const r = await conversar(request, L, '3', /congregação|Código do check-in/);
    if (/congregação/.test(r.text)) await conversar(request, L, '1', /Código do check-in/);
  });

  test('6 → grupo → números do grupo', async ({ request }) => {
    await menu(request);
    const g = await conversar(request, L, '6', /Qual grupo|União de Jovens/);
    if (/Qual grupo/.test(g.text)) await conversar(request, L, '1', /Ver membros/);
    const n = await conversar(request, L, '4', /Números/);
    expect(n.text).toMatch(/Membros:/);
  });

  test('9 → aniversariantes da semana', async ({ request }) => {
    await menu(request);
    await conversar(request, L, '9', /1\. Da semana/);
    const a = await conversar(request, L, '1', /Aniversariantes da semana/);
    expect(a.text).toMatch(/parabéns são enviados automaticamente/);
  });

  test('10 → relatório da semana', async ({ request }) => {
    await menu(request);
    const r = await conversar(request, L, '10', /Relatório da semana/);
    expect(r.text).toMatch(/EBD/);
  });

  test('11 → pedido de oração com pergunta de confidencialidade', async ({ request }) => {
    await menu(request);
    await conversar(request, L, '11', /1\. Fazer um pedido/);
    await conversar(request, L, '1', /pedido de oração/i);
    await conversar(request, L, 'Pela saúde da família do líder', /equipe de intercessão/);
    const fim = await conversar(request, L, '2', /Pedido registrado/);
    expect(fim).toBeTruthy();
  });

  test('16 → impacto do mês', async ({ request }) => {
    await menu(request);
    const i = await conversar(request, L, '16', /Impacto do PastorIA/);
    expect(i.text).toMatch(/de secretaria economizadas/);
  });

  test('opção inexistente (99) não quebra: cai no assistente', async ({ request }) => {
    await menu(request);
    const r = await conversar(request, L, '99', /./);
    expect(r.text.length).toBeGreaterThan(5);
  });
});
