// Renderiza cada <section class="card"> em PNG.
// Uso (da raiz do repo):
//   node marketing/src/render-cards.js            cards.html    → marketing/cards/
//   node marketing/src/render-cards.js campanha   campanha.html → marketing/campanha-quem-falta/cards/
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const CHROME = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const SETS = {
  kit: { html: 'cards.html', out: path.join(__dirname, '..', 'cards') },
  campanha: { html: 'campanha.html', out: path.join(__dirname, '..', 'campanha-quem-falta', 'cards') },
};
const { html: HTML, out: OUT } = SETS[process.argv[2] || 'kit'];

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || CHROME });
  const page = await browser.newPage({ viewport: { width: 2400, height: 1200 }, deviceScaleFactor: 1 });
  fs.mkdirSync(OUT, { recursive: true });
  await page.goto('file://' + path.join(__dirname, HTML));
  await page.evaluate(() => document.fonts.ready);
  const ids = await page.$$eval('section.card', (els) => els.map((e) => e.id));
  for (const id of ids) {
    await page.locator('#' + id).screenshot({ path: path.join(OUT, `${id}.png`) });
    console.log('ok', id);
  }
  await browser.close();
})();
