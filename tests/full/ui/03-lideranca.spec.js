// Telas da liderança (master): todas carregam sem erro, e os fluxos principais funcionam pela web.
const { test, expect } = require('@playwright/test');
const { sessao, vigiar, semErros } = require('./util');

test.use({ storageState: sessao('master') });

const ROTAS = [
  ['/dashboard', /Dashboard|Olá|Bem-vind/i],
  ['/impacto', /Impacto/],
  ['/members', /Pessoas/],
  ['/approvals', /Aprova/],
  ['/whatsapp/central', /WhatsApp/],
  ['/whatsapp/central?aba=envios', /Envi/],
  ['/whatsapp/central?aba=sair', /Descadastrados do WhatsApp/],
  ['/cuidado', /Cuidado/],
  ['/jornada', /Jornada/],
  ['/assistente', /Assistente|Barnabé/],
  ['/ebd', /EBD/],
  ['/encontros', /Encontros|Grupos/],
  ['/cultos', /Abrir check-in/],
  ['/escalas', /Escalas/],
  ['/celulas', /Células/],
  ['/eventos', /Eventos/],
  ['/campanhas', /Campanhas/],
  ['/prayer', /Pedidos de oração|oração/i],
  ['/users', /Usuários/],
  ['/configuracoes', /Configurações/],
  ['/configuracoes?aba=igreja', /Pix/],
  ['/assinatura', /Assinatura|Plano/],
  ['/primeiros-passos', /Primeiros passos/],
  ['/profile', /perfil/i],
];

test.describe('Liderança: telas', () => {
  for (const [rota, texto] of ROTAS) {
    test(`abre ${rota} sem erros`, async ({ page }) => {
      const erros = vigiar(page);
      await page.goto(rota);
      await expect(page.locator('main, #root').first().getByText(texto).first()).toBeVisible({ timeout: 15000 });
      await page.waitForLoadState('networkidle');
      semErros(erros, rota);
    });
  }
});

test.describe('Liderança: fluxos pela web', () => {
  test('pessoas: busca e ficha', async ({ page }) => {
    await page.goto('/members');
    await page.getByPlaceholder(/Buscar|Pesquisar/i).first().fill('Voluntario');
    await expect(page.getByText('Voluntario Teste').first()).toBeVisible();
  });

  test('pessoas: descadastrado (SAIR) aparece com o selo 🔕', async ({ page }) => {
    await page.goto('/members');
    await page.getByPlaceholder(/Buscar|Pesquisar/i).first().fill('Pessoa Extra F');
    await expect(page.getByText('Pessoa Extra F Teste').first()).toBeVisible();
    await expect(page.getByTitle(/SAIR|descadastr/i).first()).toBeVisible();
  });

  test('central: aba Descadastrados lista quem saiu', async ({ page }) => {
    await page.goto('/whatsapp/central?aba=sair');
    await expect(page.getByText(/00000000205|Pessoa Extra F/).first()).toBeVisible();
  });

  test('cultos: abre o check-in e mostra o QR', async ({ page }) => {
    await page.goto('/cultos');
    await page.getByRole('button', { name: /Abrir check-in e gerar QR/ }).click();
    await expect(page.locator('img[src^="data:image/png"]').first()).toBeVisible();
    await expect(page.getByText(/CHEGUEI/).first()).toBeVisible();
    await page.getByRole('button', { name: /Mostrar no telão/ }).click();
    await expect(page.locator('img[src^="data:image/png"]').last()).toBeVisible();
  });

  test('eventos: cria um evento pago e vê o Pix', async ({ page }) => {
    const erros = vigiar(page);
    await page.goto('/eventos');
    await page.getByRole('button', { name: '+ Novo evento' }).click();
    const d = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
    await page.getByLabel('Nome do evento').fill('Congresso UI E2E');
    await page.getByLabel('Data').fill(d);
    await page.getByLabel('Valor (R$)').fill('40');
    await page.getByRole('button', { name: /Criar evento/ }).click();
    await page.getByText('Congresso UI E2E').first().click();
    await page.getByRole('button', { name: 'Ver Pix' }).click();
    await expect(page.getByAltText('QR Code Pix de exemplo')).toBeVisible();
    await expect(page.getByText(/000201\d*.*br\.gov\.bcb\.pix/).first()).toBeVisible();
    semErros(erros, '/eventos');
  });

  test('campanhas: prévia do público mostra quantos recebem e os descadastrados', async ({ page }) => {
    await page.goto('/campanhas');
    await expect(page.getByText(/descadastrad/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('oração: lista com pedidos e intercessores', async ({ page }) => {
    await page.goto('/prayer');
    await expect(page.getByText(/cirurgia/).first()).toBeVisible();
    await expect(page.getByText(/Intercessor/i).first()).toBeVisible();
  });
});
