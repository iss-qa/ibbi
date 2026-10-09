// Renderiza cada <section class="card"> de cards.html em PNG (marketing/cards/).
// Uso (da raiz do repo): node marketing/src/render-cards.js
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const CHROME = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const OUT = path.join(__dirname, '..', 'cards');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || CHROME });
  const page = await browser.newPage({ viewport: { width: 2400, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'cards.html'));
  await page.evaluate(() => document.fonts.ready);
  const ids = await page.$$eval('section.card', (els) => els.map((e) => e.id));
  for (const id of ids) {
    await page.locator('#' + id).screenshot({ path: path.join(OUT, `${id}.png`) });
    console.log('ok', id);
  }
  await browser.close();
})();
