import { chromium } from 'playwright';

const baseUrl = process.env.UI_URL || 'http://localhost:4173';
const login = process.env.LOGIN || 'Isaias';
const senha = process.env.SENHA || 'Is@i@s1989';

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  await page.fill('input[placeholder="seu login"]', login);
  await page.fill('input[placeholder="sua senha"]', senha);
  await page.click('button:has-text("Entrar")');

  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  const hasErrorText = await page.locator('text=Falha no login').isVisible().catch(() => false);

  console.log(JSON.stringify({ currentUrl, hasErrorText, errors }, null, 2));

  await browser.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
