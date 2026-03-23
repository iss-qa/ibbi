const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

async function getBase64Image(urlOrPath) {
  if (!urlOrPath) return null;

  const normalized = String(urlOrPath).trim();

  if (normalized.startsWith('http')) {
    try {
      const resp = await axios.get(normalized, { responseType: 'arraybuffer' });
      const mime = resp.headers['content-type'] || 'image/jpeg';
      return `data:${mime};base64,${Buffer.from(resp.data).toString('base64')}`;
    } catch {
      return null;
    }
  }

  const cleanPath = normalized.replace(/^\/?uploads\//, '');
  const candidates = [
    path.resolve(__dirname, '../../../uploads', cleanPath),
    path.resolve(__dirname, '../../../../uploads', cleanPath),
  ];

  const finalPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!finalPath) {
    return null;
  }

  const ext = path.extname(finalPath).substring(1) || 'jpeg';
  const data = fs.readFileSync(finalPath);
  return `data:image/${ext};base64,${data.toString('base64')}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTemplateBackground(templatePath) {
  if (!fs.existsSync(templatePath)) {
    return 'background-color: #f8f9fa;';
  }

  const data = fs.readFileSync(templatePath);
  return `background-image: url('data:image/png;base64,${data.toString('base64')}'); background-size: cover; background-position: center;`;
}

function getFontUrl(fileName) {
  return `file://${path.join(__dirname, '../assets/fonts', fileName).replace(/\\/g, '/')}`;
}

function renderHtml({ person, isPortrait, width, height, bgCss, b64Photo }) {
  const firstName = person.nome ? person.nome.split(' ')[0] : 'Membro';
  const safeFirstName = escapeHtml(firstName);
  const safeFullName = escapeHtml(person.nome || 'Membro');
  const titleSize = isPortrait
    ? (firstName.length > 10 ? 82 : 94)
    : (firstName.length > 10 ? 84 : 104);
  const nameSize = isPortrait
    ? (firstName.length > 10 ? 110 : 132)
    : (firstName.length > 10 ? 118 : 146);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @font-face {
            font-family: 'Great Vibes';
            src: url('${getFontUrl('GreatVibes-Regular.ttf')}') format('truetype');
          }
          @font-face {
            font-family: 'Inter';
            src: url('${getFontUrl('Inter-Regular.ttf')}') format('truetype');
            font-weight: 400;
          }
          @font-face {
            font-family: 'Inter';
            src: url('${getFontUrl('Inter-Medium.ttf')}') format('truetype');
            font-weight: 500;
          }
          @font-face {
            font-family: 'Inter';
            src: url('${getFontUrl('Inter-Bold.ttf')}') format('truetype');
            font-weight: 700;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: ${width}px;
            height: ${height}px;
            ${bgCss}
            position: relative;
            overflow: hidden;
            font-family: 'Inter', sans-serif;
            color: #10264d;
          }
          body::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              linear-gradient(180deg, rgba(7, 23, 51, 0.14) 0%, rgba(7, 23, 51, 0.04) 22%, rgba(255, 255, 255, 0.12) 100%),
              radial-gradient(circle at top left, rgba(255,255,255,0.92), rgba(255,255,255,0.18) 42%, transparent 64%);
          }
          .shell {
            position: relative;
            z-index: 1;
            width: 100%;
            height: 100%;
            padding: ${isPortrait ? '84px' : '78px 94px'};
            display: flex;
            flex-direction: column;
          }
          .brand {
            align-self: ${isPortrait ? 'center' : 'flex-start'};
            padding: 16px 28px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.84);
            border: 1px solid rgba(255, 255, 255, 0.85);
            box-shadow: 0 18px 38px rgba(8, 22, 49, 0.08);
            font-size: ${isPortrait ? '26px' : '24px'};
            letter-spacing: 0.16em;
            text-transform: uppercase;
            font-weight: 700;
            color: #18386f;
          }
          .frame {
            flex: 1;
            margin-top: ${isPortrait ? '42px' : '34px'};
            border-radius: ${isPortrait ? '48px' : '44px'};
            background: rgba(255, 253, 249, 0.72);
            border: 1px solid rgba(255, 255, 255, 0.85);
            box-shadow: 0 28px 70px rgba(8, 22, 49, 0.12);
            backdrop-filter: blur(8px);
            position: relative;
            overflow: hidden;
          }
          .frame::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.6), transparent 42%),
              radial-gradient(circle at bottom right, rgba(201,162,39,0.16), transparent 38%);
            pointer-events: none;
          }
          .content {
            position: relative;
            z-index: 1;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: ${isPortrait ? 'column' : 'row'};
            align-items: center;
            justify-content: center;
            gap: ${isPortrait ? '46px' : '72px'};
            padding: ${isPortrait ? '72px 62px 54px' : '64px 72px'};
          }
          .photo-card {
            width: 560px;
            height: ${isPortrait ? '720px' : '690px'};
            border-radius: 38px;
            padding: 18px;
            background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,255,0.92));
            box-shadow: 0 22px 54px rgba(8, 22, 49, 0.14);
            flex-shrink: 0;
          }
          .photo {
            width: 100%;
            height: 100%;
            border-radius: 28px;
            background:
              linear-gradient(180deg, rgba(15, 46, 94, 0.06), rgba(15, 46, 94, 0.18)),
              ${b64Photo ? `url("${b64Photo}") center/cover no-repeat` : 'linear-gradient(135deg, #e8eef9, #d8e3f6)'};
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .photo::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0));
          }
          .photo-placeholder {
            position: relative;
            z-index: 1;
            width: 100%;
            text-align: center;
            padding: 0 32px;
            color: #54719f;
          }
          .photo-placeholder-badge {
            width: 148px;
            height: 148px;
            border-radius: 999px;
            margin: 0 auto 24px;
            border: 2px dashed rgba(84, 113, 159, 0.42);
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.42);
          }
          .photo-placeholder svg {
            width: 76px;
            height: 76px;
            opacity: 0.72;
          }
          .photo-placeholder-title {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .photo-placeholder-subtitle {
            margin-top: 10px;
            font-size: 26px;
            line-height: 1.45;
          }
          .text-panel {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: ${isPortrait ? 'center' : 'flex-start'};
            text-align: ${isPortrait ? 'center' : 'left'};
            width: 100%;
            max-width: ${isPortrait ? '100%' : '980px'};
          }
          .title-row {
            display: flex;
            align-items: baseline;
            justify-content: ${isPortrait ? 'center' : 'flex-start'};
            gap: 20px;
            flex-wrap: nowrap;
            width: 100%;
            white-space: nowrap;
            color: #10356e;
          }
          .title-prefix {
            font-size: ${titleSize}px;
            line-height: 1;
            font-weight: 700;
            letter-spacing: -0.04em;
          }
          .title-name {
            font-family: 'Great Vibes', cursive;
            font-size: ${nameSize}px;
            line-height: 0.95;
            color: #0b4dbf;
            text-shadow: 0 8px 26px rgba(11, 77, 191, 0.12);
          }
          .subtitle {
            margin-top: 24px;
            font-size: ${isPortrait ? '34px' : '32px'};
            line-height: 1.45;
            max-width: ${isPortrait ? '760px' : '920px'};
            color: #29446f;
            font-weight: 500;
          }
          .verse-card {
            margin-top: 34px;
            width: ${isPortrait ? '100%' : '880px'};
            max-width: 100%;
            padding: ${isPortrait ? '28px 30px' : '30px 34px'};
            border-radius: 30px;
            background: rgba(255, 255, 255, 0.74);
            border: 1px solid rgba(255,255,255,0.9);
            box-shadow: 0 16px 38px rgba(8, 22, 49, 0.08);
          }
          .verse-label {
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: #7b8cab;
            margin-bottom: 14px;
          }
          .verse {
            font-size: 34px;
            line-height: 1.62;
            color: #1f3761;
            font-style: italic;
          }
          .footer-chip {
            margin-top: ${isPortrait ? '32px' : '28px'};
            align-self: ${isPortrait ? 'center' : 'flex-start'};
            padding: 20px 34px;
            border-radius: 999px;
            background: linear-gradient(135deg, #0a2a58, #114d9e);
            color: #fff;
            font-size: 40px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            box-shadow: 0 18px 40px rgba(11, 77, 191, 0.22);
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <div class="brand">IBBI</div>
          <div class="frame">
            <div class="content">
              <div class="photo-card">
                <div class="photo">
                  ${!b64Photo ? `
                    <div class="photo-placeholder">
                      <div class="photo-placeholder-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                          <circle cx="12" cy="8" r="3.5"></circle>
                          <path stroke-linecap="round" d="M4 19c1.8-3.7 5-5.5 8-5.5s6.2 1.8 8 5.5"></path>
                        </svg>
                      </div>
                      <div class="photo-placeholder-title">${safeFirstName}</div>
                      <div class="photo-placeholder-subtitle">Espaço reservado para a foto do aniversariante</div>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="text-panel">
                <div class="title-row">
                  <div class="title-prefix">Parabéns,</div>
                  <div class="title-name">${safeFirstName}</div>
                </div>

                ${isPortrait ? `
                  <div class="subtitle">Celebramos a vida de ${safeFullName} com gratidão ao Senhor por mais um ano de bênçãos.</div>
                ` : `
                  <div class="subtitle">Feliz aniversário! Que o Senhor continue guiando seus passos com graça, paz e alegria em cada novo dia.</div>
                `}

                <div class="verse-card">
                  <div class="verse-label">Versículo Bíblico</div>
                  <div class="verse">"Este é o dia que o Senhor fez; nele nos alegraremos e exultaremos."<br/>Salmos 118:24</div>
                </div>

                <div class="footer-chip">Feliz Aniversário</div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

const generateBirthdayCard = async (person, format = 'portrait') => {
  const isPortrait = format === 'portrait';
  const width = isPortrait ? 1080 : 1920;
  const height = isPortrait ? 1920 : 1080;
  const templatePath = path.join(__dirname, '../assets/templates', isPortrait ? 'portrait.png' : 'landscape.png');
  const bgCss = buildTemplateBackground(templatePath);
  const b64Photo = await getBase64Image(person.fotoUrl);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(
      renderHtml({ person, isPortrait, width, height, bgCss, b64Photo }),
      { waitUntil: 'networkidle0' }
    );
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
};

module.exports = {
  generateBirthdayCard,
};
