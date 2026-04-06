import { test, expect } from '@playwright/test';
import { MemberPage } from './pom/MemberPage';

test.describe('Gestão de Membros - Bug fixes e Validações', () => {
  let memberPage;

  test.beforeEach(async ({ page }) => {
    memberPage = new MemberPage(page);
    await memberPage.login(process.env.TEST_LOGIN, process.env.TEST_PASSWORD);
    await expect(page).toHaveURL(/.*dashboard/);
    await page.goto('/members');
  });

  test('Deve impedir o cadastro de membro duplicado (mesmo nome e celular)', async ({ page }) => {
    const nome = 'Teste Duplicado';
    const celular = '(71) 99999-0000';

    // Garante que o primeiro cadastro exista (ou tenta cadastrar o primeiro)
    await memberPage.createMember(nome, celular);
    
    // Tenta cadastrar o segundo (duplicado)
    await memberPage.createMember(nome, celular);

    // Valida a mensagem de erro retornada pelo backend
    const error = page.locator('.bg-red-50');
    await expect(error).toBeVisible();
    await expect(error).toContainText(`O membro "${nome}" já possui um cadastro com o celular informado.`);
  });

  test('Deve persistir a foto do membro ao salvar', async ({ page }) => {
    const nome = 'Membro com Foto';
    const celular = '(71) 88888-1111';
    // Nota: O arquivo fix.png precisa existir para o teste rodar, 
    // ou use um buffer/blob simulado se necessário.
    const photoPath = 'tests/fixtures/test-photo.png';

    // Cria diretório de fixtures e arquivo se necessário (apenas para demonstração)
    // No ambiente real, o arquivo já estaria lá.

    await memberPage.createMember(nome, celular, photoPath);

    // Verifica se o membro aparece na lista com o avatar correto
    const row = page.locator('tr', { hasText: nome });
    await expect(row).toBeVisible();
    
    const avatarImg = row.locator('img');
    await expect(avatarImg).toBeVisible();
    const src = await avatarImg.getAttribute('src');
    expect(src).toContain('/uploads/');
    expect(src).not.toContain('localhost:3001'); // Verifica se não está hardcoded
  });
});
