const crypto = require('crypto');
const axios = require('axios');

// Cliente Woovi (OpenPix) para as cobranças Pix da assinatura.
// Auth: header `Authorization: <AppID>` (sem "Bearer"). Valores sempre em centavos.
// A conta Woovi é compartilhada com outros produtos: toda cobrança do PastorIA leva o prefixo
// CORRELATION_PREFIX, e o webhook ignora eventos de cobranças que não são nossas.
const CORRELATION_PREFIX = 'pastoria-';

const isProduction = () => (process.env.WOOVI_ENV || 'sandbox') === 'production';
const appId = () => (isProduction() ? process.env.WOOVI_PROD_APP_ID : process.env.WOOVI_SANDBOX_APP_ID) || '';
const baseUrl = () => (process.env.WOOVI_API_URL
  || (isProduction() ? 'https://api.woovi.com' : 'https://api.woovi-sandbox.com')).replace(/\/$/, '');

const enabled = () => Boolean(appId());

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

const request = async (method, path, data) => {
  for (let tentativa = 0; ; tentativa += 1) {
    try {
      const res = await axios({
        method,
        url: `${baseUrl()}${path}`,
        data,
        headers: { Authorization: appId(), 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 20000,
      });
      return res.data;
    } catch (err) {
      // 429: a Woovi limita rajadas — espera (Retry-After ou backoff) e tenta de novo
      if (err.response?.status === 429 && tentativa < 3) {
        const ra = Number(err.response.headers?.['retry-after']);
        await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 800 * 2 ** tentativa);
        continue;
      }
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      const e = new Error(`Woovi: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
      e.status = err.response?.status;
      throw e;
    }
  }
};

// A Woovi recusa emoji e vários símbolos no `comment` (vai para o infoPagador do Pix).
const sanitizeComment = (texto) => String(texto || '')
  .normalize('NFC')
  .replace(/[·•]/g, '-')
  .replace(/[—–]/g, '-')
  .replace(/[^A-Za-z0-9À-ÿ .,\-/()#:]/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim()
  .slice(0, 140);

// Woovi exige name + (taxID | email | phone). Sem nenhum dos três, a cobrança sai sem cliente.
const customerFor = (tenant) => {
  const taxID = String(tenant.documento || '').replace(/\D/g, '');
  const phone = String(tenant.telefone || '').replace(/\D/g, '');
  const customer = {
    name: String(tenant.nome || 'Igreja').slice(0, 100),
    ...([11, 14].includes(taxID.length) ? { taxID } : {}),
    ...(tenant.email ? { email: tenant.email } : {}),
    ...(phone.length >= 10 ? { phone: phone.startsWith('55') ? phone : `55${phone}` } : {}),
  };
  return customer.taxID || customer.email || customer.phone ? customer : undefined;
};

// Boleto (cobrança tipo BOLETO gera boleto + Pix). A Woovi precisa habilitar o recurso na conta
// (WOOVI_BOLETO=true) e exige CNPJ/CPF e endereço completo do pagador.
const boletoEnabled = () => process.env.WOOVI_BOLETO === 'true';
const boletoCustomerFor = (tenant) => {
  const base = customerFor(tenant);
  const e = tenant.endereco || {};
  const cep = String(e.cep || '').replace(/\D/g, '');
  if (!base?.taxID || cep.length !== 8 || !e.logradouro || !e.numero || !e.bairro || !tenant.cidade || !/^[A-Z]{2}$/i.test(tenant.uf || '')) return null;
  return {
    ...base,
    address: {
      zipcode: cep, street: e.logradouro, number: String(e.numero), neighborhood: e.bairro,
      city: tenant.cidade, state: String(tenant.uf).toUpperCase(), country: 'BR',
      ...(e.complemento ? { complement: e.complemento } : {}),
    },
  };
};

const createCharge = async ({ correlationID, valueCents, comment, customer, expiresDate, additionalInfo, type = 'DYNAMIC' }) => {
  const data = await request('post', '/api/v1/charge', {
    correlationID,
    value: valueCents,
    type,
    ...(comment ? { comment: sanitizeComment(comment) } : {}),
    ...(customer ? { customer } : {}),
    ...(expiresDate ? { expiresDate: new Date(expiresDate).toISOString() } : {}),
    ...(additionalInfo?.length ? { additionalInfo } : {}),
  });
  return data.charge;
};

// Fonte da verdade do pagamento: o webhook só avisa, a baixa confere a cobrança aqui.
const getCharge = async (correlationID) => {
  try {
    const data = await request('get', `/api/v1/charge/${encodeURIComponent(correlationID)}`);
    return data.charge || null;
  } catch (err) {
    // A Woovi responde 400 "Cobrança não encontrada" (não 404) para correlationID inexistente/removido
    if (err.status === 404 || /n[ãa]o encontrad/i.test(err.message)) return null;
    throw err;
  }
};

const deleteCharge = async (correlationID) => {
  try {
    await request('delete', `/api/v1/charge/${encodeURIComponent(correlationID)}`);
    return true;
  } catch (err) {
    console.warn(`[WOOVI] Falha ao remover cobrança ${correlationID}:`, err.message);
    return false;
  }
};

// ── Webhook ─────────────────────────────────────────────────────────────
// Assinatura oficial: header `x-webhook-signature` = base64(RSA-SHA256) do corpo bruto,
// verificada com as chaves públicas de GET /api/v1/webhook/public-keys (sem auth; lista
// para permitir rotação). Alternativa: o valor de WOOVI_WEBHOOK_SECRET no header
// `Authorization` configurado no webhook pelo painel da Woovi.
const KEYS_TTL_MS = 12 * 60 * 60 * 1000;
let keysCache = { keys: [], at: 0 };

const publicKeys = async ({ force = false } = {}) => {
  if (!force && keysCache.keys.length && Date.now() - keysCache.at < KEYS_TTL_MS) return keysCache.keys;
  const { data } = await axios.get(`${baseUrl()}/api/v1/webhook/public-keys`, { timeout: 10000 });
  const keys = (data?.public_keys || []).map((k) => k.key).filter(Boolean);
  if (keys.length) keysCache = { keys, at: Date.now() };
  return keys;
};

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length > 0 && ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const rsaValid = (keys, rawBody, signature) => keys.some((key) => {
  try {
    return crypto.verify('sha256', rawBody, key, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
});

const verifyWebhook = async (rawBody, headers = {}) => {
  const secret = process.env.WOOVI_WEBHOOK_SECRET;
  const auth = String(headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (secret && safeEqual(auth, secret)) return true;

  const signature = String(headers['x-webhook-signature'] || '').trim();
  if (!signature || !rawBody) return false;
  try {
    if (rsaValid(await publicKeys(), rawBody, signature)) return true;
    // Chave rotacionada desde o último cache
    return rsaValid(await publicKeys({ force: true }), rawBody, signature);
  } catch (err) {
    console.error('[WOOVI] Falha ao buscar chaves públicas do webhook:', err.message);
    return false;
  }
};

// correlationID em qualquer formato de payload (charge, pix.charge, pix).
const correlationIdOf = (body) => body?.charge?.correlationID
  || body?.pix?.charge?.correlationID
  || body?.pix?.correlationID
  || body?.correlationID
  || null;

module.exports = {
  CORRELATION_PREFIX,
  enabled,
  boletoEnabled,
  boletoCustomerFor,
  isProduction,
  customerFor,
  sanitizeComment,
  createCharge,
  getCharge,
  deleteCharge,
  verifyWebhook,
  correlationIdOf,
};
