// Helpers da suíte completa: login com cache, chamadas autenticadas e WhatsApp (webhook + caixa de saída).
const { expect } = require('@playwright/test');
const E2E = require('./config');

const tokens = new Map();

// Login uma vez por perfil (o limite é 30 logins / 15 min por IP).
const login = async (request, { login: usuario = 'master', igreja = E2E.igrejas.a, senha = E2E.senha } = {}) => {
  const chave = `${igreja}:${usuario}`;
  if (tokens.has(chave)) return tokens.get(chave);
  const res = await request.post(`${E2E.apiUrl}/auth/login`, { data: { login: usuario, senha, igreja } });
  expect(res.status(), `login ${chave}: ${await res.text()}`).toBe(200);
  const body = await res.json();
  tokens.set(chave, body);
  return body;
};

// Cliente autenticado: api.get('/persons'), api.post('/x', dados)…
const cliente = async (request, opts) => {
  const { token } = await login(request, opts);
  const h = { Authorization: `Bearer ${token}` };
  const url = (p) => `${E2E.apiUrl}${p}`;
  return {
    token,
    get: (p, params) => request.get(url(p), { headers: h, params }),
    post: (p, data) => request.post(url(p), { headers: h, data }),
    put: (p, data) => request.put(url(p), { headers: h, data }),
    del: (p) => request.delete(url(p), { headers: h }),
  };
};

let seqMsg = 0;
// Simula uma mensagem recebida no WhatsApp da igreja (webhook da Evolution).
const whats = async (request, de, texto, { igreja = E2E.igrejas.a, media } = {}) => {
  seqMsg += 1;
  const message = media ? { [`${media.kind}Message`]: { mimetype: media.mimetype, ...(media.seconds ? { seconds: media.seconds } : {}) }, base64: media.base64 } : { conversation: texto };
  const res = await request.post(`${E2E.apiUrl}/webhooks/evolution/${igreja}?token=${E2E.webhookToken}-${igreja}`, {
    data: { event: 'messages.upsert', data: { key: { remoteJid: `55${de}@s.whatsapp.net`, fromMe: false, id: `e2e-${Date.now()}-${seqMsg}` }, pushName: 'Teste', message } },
  });
  expect(res.status()).toBe(200);
};

const caixa = async (request, numero) => (await request.get(`${E2E.mockUrl}/__outbox`, { params: numero ? { number: numero } : {} })).json();
const limparCaixa = (request) => request.delete(`${E2E.mockUrl}/__outbox`);

// Espera chegar (no WhatsApp falso) uma mensagem para `numero` que case com `re`, depois de `desde`.
const esperarMsg = async (request, numero, re, { desde = 0, timeout = 15000 } = {}) => {
  let achada = null;
  await expect.poll(async () => {
    const lista = await caixa(request, numero);
    achada = lista.find((m) => m.seq > desde && re.test(m.text)) || null;
    return Boolean(achada);
  }, { timeout, message: `mensagem ${re} para ${numero}` }).toBe(true).catch(async (err) => {
    // Diagnóstico: últimas mensagens enviadas pelo WhatsApp falso (para qualquer número)
    const ult = (await caixa(request)).slice(-6).map((m) => `#${m.seq} ${m.number.slice(-4)} ${new Date(m.em).toISOString().slice(11, 19)} ${m.text.slice(0, 50).replace(/\n/g, ' ')}`);
    err.message += `\nÚltimos envios:\n${ult.join('\n')}`;
    throw err;
  });
  return achada;
};
const ultimoSeq = async (request) => { const l = await caixa(request); return l.length ? l[l.length - 1].seq : 0; };
// Envia e espera a resposta (padrão: qualquer mensagem nova para o mesmo número)
const conversar = async (request, de, texto, re = /./, opts = {}) => {
  const desde = await ultimoSeq(request);
  await whats(request, de, texto, opts);
  return esperarMsg(request, de, re, { desde, ...opts });
};
const nadaChega = async (request, numero, desde, ms = 2500) => {
  await new Promise((r) => setTimeout(r, ms));
  const novas = (await caixa(request, numero)).filter((m) => m.seq > desde);
  expect(novas, `não deveria haver mensagem para ${numero}: ${novas.map((m) => m.text.slice(0, 60)).join(' | ')}`).toHaveLength(0);
};

// Data AAAA-MM-DD daqui a `dias` no fuso da igreja de teste
const diaIso = (dias = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date(Date.now() + dias * 864e5));
// Envios em lote respeitam o piso anti-ban de 30s entre mensagens: espera mais longa.
const LOTE = { timeout: 75000 };

module.exports = { E2E, diaIso, LOTE, login, cliente, whats, caixa, limparCaixa, esperarMsg, ultimoSeq, conversar, nadaChega };
