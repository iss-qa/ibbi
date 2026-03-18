import { expect } from '@playwright/test';

export class MemberPage {
  constructor(page) {
    this.page = page;
    this.newMemberBtn = page.getByRole('button', { name: 'Novo membro' });
    this.nameInput = page.getByPlaceholder('Nome e sobrenome');
    this.phoneInput = page.getByPlaceholder('(00) 00000-0000');
    this.saveBtn = page.getByRole('button', { name: 'Salvar membro' });
    this.errorMsg = page.locator('.bg-red-50');
    this.photoInput = page.locator('input[type="file"]');
    this.photoBtn = page.getByTitle('Clique para enviar foto');
  }

  async login(login, senha) {
    await this.page.goto('/login');
    await this.page.getByPlaceholder('Seu login').fill(login);
    await this.page.getByPlaceholder('Sua senha').fill(senha);
    await this.page.getByRole('button', { name: 'Entrar no sistema' }).click();
  }

  async createMember(name, phone, photoPath = null) {
    await this.newMemberBtn.click();
    await this.nameInput.fill(name);
    await this.phoneInput.fill(phone);
    
    if (photoPath) {
      const fileChooserPromise = this.page.waitForEvent('filechooser');
      await this.photoBtn.click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(photoPath);
      // Aguarda o upload (spinner desaparece)
      await expect(this.page.locator('.animate-spin')).not.toBeVisible();
    }
    
    await this.saveBtn.click();
  }
}
