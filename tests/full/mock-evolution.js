// WhatsApp falso (imita a Evolution API v2) e Woovi falsa (cobranças Pix) para a suíte E2E.
// Sem dependências. Guarda cada envio em memória; os testes leem/limpam em /__outbox.
// Woovi: /api/v1/charge…, chaves públicas do webhook e rotas de controle em /__woovi/*.
const http = require('http');
const crypto = require('crypto');
const { portas, backendEnv } = require('./config');

const charges = new Map(); // correlationID → cobrança
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

// Rotas da Woovi falsa. Retorna true se tratou a requisição.
const woovi = (req, res, url, raw) => {
  const p = url.pathname;
  if (p === '/api/v1/webhook/public-keys') return json(res, 200, { public_keys: [{ key_identifier: 'e2e', is_current: true, key: publicPem }] }) || true;
  if (p === '/__woovi/charges') return json(res, 200, [...charges.values()]) || true;
  // Assina um corpo como a Woovi assina os webhooks: base64(RSA-SHA256) do corpo bruto
  if (p === '/__woovi/sign' && req.method === 'POST') return json(res, 200, { signature: crypto.sign('sha256', Buffer.from(raw), privateKey).toString('base64') }) || true;
  const pay = p.match(/^\/__woovi\/pay\/(.+)$/);
  if (pay && req.method === 'POST') {
    const c = charges.get(decodeURIComponent(pay[1]));
    if (!c) return json(res, 404, { error: 'não existe' }) || true;
    Object.assign(c, { status: 'COMPLETED', paidAt: new Date().toISOString() });
    return json(res, 200, { charge: c }) || true;
  }
  if (!p.startsWith('/api/v1/charge')) return false;
  if (req.headers.authorization !== backendEnv.WOOVI_SANDBOX_APP_ID) return json(res, 401, { error: 'appID inválido' }) || true;
  const nf = () => json(res, 400, { error: 'Cobrança não encontrada' }) || true;
  if (p === '/api/v1/charge' && req.method === 'POST') {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { /* corpo inválido */ }
    if (!body.correlationID || !Number.isInteger(body.value)) return json(res, 400, { error: 'dados inválidos' }) || true;
    if (charges.has(body.correlationID)) return json(res, 400, { error: 'correlationID já existe' }) || true;
    const c = {
      ...body, status: 'ACTIVE', globalID: `g-${charges.size + 1}`, brCode: `00020101021226e2e${body.correlationID}5204000053039865802BR6304ABCD`,
      paymentLinkUrl: `https://woovi.example/pay/${body.correlationID}`, expiresDate: body.expiresDate || new Date(Date.now() + 864e5).toISOString(),
    };
    charges.set(body.correlationID, c);
    return json(res, 200, { charge: c, correlationID: c.correlationID, brCode: c.brCode }) || true;
  }
  const one = p.match(/^\/api\/v1\/charge\/(.+)$/);
  if (!one) return false;
  const id = decodeURIComponent(one[1]);
  const c = charges.get(id);
  if (!c) return nf();
  if (req.method === 'GET') return json(res, 200, { charge: c }) || true;
  if (req.method === 'DELETE') {
    if (c.status === 'COMPLETED') return json(res, 400, { error: 'Cobrança paga não pode ser removida' }) || true;
    charges.delete(id);
    return json(res, 200, { status: 'OK', id }) || true;
  }
  return false;
};

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
    if (woovi(req, res, url, raw)) return undefined;
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
