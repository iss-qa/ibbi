// Gera os vídeos (MP4 9:16) e os spots de áudio do PastorIA.
// Uso (da raiz do repo): node marketing/src/render-videos.js [manifesto|chamada|audios]
// Requer: macOS `say` (voz Luciana), ffmpeg, Playwright (Chromium em cache).
//
// A narração aqui é um GUIA gerado por TTS do sistema. Para a versão final, grave um locutor
// ou use os prompts de voz em marketing/prompts/ e substitua os WAVs mantendo os mesmos textos.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(os.tmpdir(), 'pastoria-marketing');
const CHROME = path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
const FPS = 30;
const VOICE = process.env.VOICE || 'Luciana';

const VIDEOS = {
  manifesto: {
    html: 'video-manifesto.html',
    out: 'videos/pastoria-manifesto-9x16.mp4',
    segments: [
      { key: 's1', min: 2.4, text: 'Ninguém se afasta da igreja de uma vez.' },
      { key: 's1b', min: 3.8, text: 'Primeiro, um domingo. Depois, dois. Depois, três.' },
      { key: 's2', min: 3.4, text: 'Quando alguém percebe, a distância já virou silêncio.' },
      { key: 's3', min: 3.0, text: 'Quem falta, faz falta.' },
      { key: 's4', min: 7.6, text: 'O PastorIA faz a chamada pelo WhatsApp, percebe quem está se afastando e já sugere uma mensagem de cuidado.' },
      { key: 's5', min: 3.6, text: 'E a liderança fica sabendo na hora.' },
      { key: 's6', min: 3.8, text: 'A IA avisa. O pastor abraça.' },
      { key: 's7', min: 4.2, text: 'PastorIA. Teste grátis por catorze dias.' },
    ],
  },
  chamada: {
    html: 'video-chamada.html',
    out: 'videos/pastoria-chamada-9x16.mp4',
    segments: [
      { key: 'c1', min: 3.0, text: 'Domingo, onze e meia. A aula acabou. E a chamada?' },
      { key: 'c2', min: 3.6, text: 'O Barnabé, assistente do PastorIA, manda a lista da turma no WhatsApp do líder.' },
      { key: 'c3', min: 2.4, text: 'O líder responde só os números de quem faltou.' },
      { key: 'c4', min: 5.2, text: 'Bruno está na terceira falta seguida. Com um simples sim, ele recebe uma mensagem de cuidado.' },
      { key: 'c5', min: 3.4, text: 'Horas depois: Domingo estou aí.' },
      { key: 'c6', min: 3.6, text: 'A frequência vai para o relatório, e quem está faltando entra no radar do cuidado.' },
      { key: 'c7', min: 4.0, text: 'PastorIA. Quem falta, faz falta. Teste grátis por catorze dias.' },
    ],
  },
};

// Spots só de áudio (rádio, WhatsApp, podcast, status)
const AUDIOS = [
  {
    out: 'audios/spot-30s.m4a',
    rate: 188,
    lines: [
      'Pastor, quantas pessoas deixaram de vir à sua igreja este ano sem que ninguém percebesse?',
      'Ninguém se afasta de uma vez. É um domingo, depois outro.',
      'O PastorIA é um assistente de IA no WhatsApp da sua igreja.',
      'Ele faz a chamada, percebe quem está faltando e avisa a liderança.',
      'A IA avisa. O pastor abraça.',
      'PastorIA. Quem falta, faz falta. Teste grátis por catorze dias.',
    ],
  },
  {
    out: 'audios/spot-15s.m4a',
    rate: 190,
    lines: [
      'Sua igreja não perde membros de uma vez. Perde um domingo de cada vez.',
      'O PastorIA avisa quem está se afastando, direto no WhatsApp da liderança.',
      'PastorIA. Quem falta, faz falta.',
    ],
  },
  {
    out: 'audios/convite-whatsapp-pastor.m4a',
    rate: 165,
    music: false,
    lines: [
      'Oi, pastor, tudo bem? A paz!',
      'Queria te indicar uma ferramenta que está ajudando muito a gente aqui.',
      'Chama PastorIA. É um assistente no WhatsApp: no domingo ele manda a lista da turma, o líder responde quem faltou, e pronto, a chamada está feita.',
      'O melhor é que ele avisa quando alguém começa a faltar seguido, e ajuda a mandar uma mensagem de cuidado antes da pessoa sumir.',
      'Dá para testar catorze dias de graça, sem cartão. Vou te mandar o link aqui. Deus abençoe!',
    ],
  },
];

const sh = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const duration = (f) => parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));

function tts(text, file, rate = 172) {
  const aiff = file.replace(/\.wav$/, '.aiff');
  sh('say', ['-v', VOICE, '-r', String(rate), '-o', aiff, text]);
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '44100', '-ac', '1', file]);
  return duration(file);
}

// Trilha ambiente provisória: acorde suave (Lá maior com 9ª) com respiração lenta.
function padArgs(dur) {
  const expr = '0.045*(0.5*sin(2*PI*110*t)+sin(2*PI*220*t)+0.7*sin(2*PI*277.18*t)+0.6*sin(2*PI*329.63*t)+0.35*sin(2*PI*493.88*t))*(0.65+0.35*sin(2*PI*0.08*t))';
  return ['-f', 'lavfi', '-t', dur.toFixed(2), '-i', `aevalsrc=${expr}:s=44100`];
}

// Mistura narrações (com atraso em ms) + trilha; saída em AAC normalizado.
function mix(narrations, total, outFile, { music = true } = {}) {
  const args = ['-y', '-loglevel', 'error'];
  if (music) args.push(...padArgs(total));
  narrations.forEach((n) => args.push('-i', n.file));
  const off = music ? 1 : 0;
  const parts = narrations.map((n, i) => `[${i + off}]adelay=${Math.round(n.at * 1000)}|${Math.round(n.at * 1000)},apad[n${i}]`);
  const inputs = narrations.map((_, i) => `[n${i}]`).join('');
  let graph = parts.join(';') + ';';
  if (music) {
    graph += `[0]lowpass=f=1200,aecho=0.8:0.7:120|240:0.3|0.2,afade=t=in:d=1.5,afade=t=out:st=${(total - 2).toFixed(2)}:d=2[pad];`;
    graph += `[pad]${inputs}amix=inputs=${narrations.length + 1}:normalize=0:duration=first,`;
  } else {
    graph += `${inputs}amix=inputs=${narrations.length}:normalize=0,`;
  }
  graph += `atrim=0:${total.toFixed(2)},loudnorm=I=-16:TP=-1.5[out]`;
  args.push('-filter_complex', graph, '-map', '[out]', '-ac', '2', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', outFile);
  sh('ffmpeg', args);
}

async function renderVideo(name) {
  const cfg = VIDEOS[name];
  const dir = path.join(TMP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });

  // 1) narração → linha do tempo
  const timeline = {};
  const narrations = [];
  let t = 0;
  for (const seg of cfg.segments) {
    const file = path.join(dir, `${seg.key}.wav`);
    const d = tts(seg.text, file);
    const len = Math.max(seg.min, d + 0.9);
    timeline[seg.key] = { start: t, end: t + len };
    narrations.push({ file, at: t + 0.3 });
    t += len;
  }
  const total = t + 0.6;
  console.log(name, 'duração', total.toFixed(1) + 's', timeline);

  // 2) quadros
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || CHROME });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(__dirname, cfg.html));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((tl) => window.setup(tl), timeline);
  const frames = Math.ceil(total * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((s) => window.render(s), f / FPS);
    await page.screenshot({ path: path.join(dir, 'frames', `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
    if (f % 150 === 0) console.log(`  quadro ${f}/${frames}`);
  }
  // capa (quadro do slogan / CTA) para thumbnail
  await page.evaluate((s) => window.render(s), timeline[cfg.segments.at(-1).key].start + 2);
  await page.screenshot({ path: path.join(ROOT, cfg.out.replace('.mp4', '-capa.jpg')), type: 'jpeg', quality: 92 });
  await browser.close();

  // 3) áudio + vídeo
  const audio = path.join(dir, 'audio.m4a');
  mix(narrations, total, audio);
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'frames', '%05d.jpg'), '-i', audio,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart',
    '-c:a', 'copy', '-shortest', path.join(ROOT, cfg.out)]);
  // versão sem narração (para usar com trilha própria / locução gravada)
  sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(ROOT, cfg.out), '-an', '-c:v', 'copy', path.join(ROOT, cfg.out.replace('.mp4', '-sem-audio.mp4'))]);
  console.log('ok', cfg.out);
}

function renderAudios() {
  const dir = path.join(TMP, 'audios');
  fs.mkdirSync(dir, { recursive: true });
  for (const a of AUDIOS) {
    const narrations = [];
    let t = a.music === false ? 0.2 : 0.8;
    a.lines.forEach((line, i) => {
      const file = path.join(dir, `${path.basename(a.out, '.m4a')}-${i}.wav`);
      const d = tts(line, file, a.rate);
      narrations.push({ file, at: t });
      t += d + (a.music === false ? 0.35 : 0.4);
    });
    const total = t + (a.music === false ? 0.3 : 1.4);
    mix(narrations, total, path.join(ROOT, a.out), { music: a.music !== false });
    console.log('ok', a.out, total.toFixed(1) + 's');
  }
}

(async () => {
  const which = process.argv.slice(2);
  const all = which.length === 0;
  if (all || which.includes('audios')) renderAudios();
  for (const name of Object.keys(VIDEOS)) if (all || which.includes(name)) await renderVideo(name);
})().catch((e) => { console.error(e.stderr?.toString() || e); process.exit(1); });
