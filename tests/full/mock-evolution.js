// WhatsApp falso (imita a Evolution API v2) para a suíte E2E. Sem dependências.
// Guarda cada envio em memória; os testes leem/limpam em /__outbox.
const http = require('http');
const { portas } = require('./config');

const outbox = [];
let seq = 0;
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    if (url.pathname === '/__outbox' && req.method === 'GET') {
      const n = url.searchParams.get('number');
      return json(res, 200, n ? outbox.filter((m) => m.number.endsWith(n.slice(-8))) : outbox);
    }
    if (url.pathname === '/__outbox' && req.method === 'DELETE') { outbox.length = 0; return json(res, 200, { ok: true }); }
    if (url.pathname.startsWith('/instance/connectionState/')) return json(res, 200, { instance: { state: 'open' } });
    if (url.pathname.startsWith('/group/fetchAllGroups/')) return json(res, 200, []);
    const m = url.pathname.match(/^\/message\/(sendText|sendMedia|sendWhatsAppAudio|sendContact)\//);
    if (m && req.method === 'POST') {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch { /* corpo inválido */ }
      seq += 1;
      outbox.push({ seq, tipo: m[1], number: String(body.number || ''), text: String(body.text || body.caption || ''), media: Boolean(body.media || body.audio), em: Date.now() });
      return json(res, 201, { key: { id: `e2e-${seq}` }, status: 'PENDING' });
    }
    return json(res, 404, { message: `rota não simulada: ${req.method} ${url.pathname}` });
  });
}).listen(portas.mock, '127.0.0.1', () => console.log(`[mock-evolution] ouvindo em ${portas.mock}`));
