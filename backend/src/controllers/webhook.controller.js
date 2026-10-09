const crypto = require('crypto');
const Tenant = require('../models/Tenant.model');
const { runAsPlatform, runWithTenant } = require('../tenancy/context');
const { getTenantBySlug, getTenantById } = require('../tenancy/tenant.service');
const { handleInbound } = require('../services/ai/inbound.service');
const { handleWooviEvent, invoiceIdFrom } = require('../services/billing.service');
const woovi = require('../services/woovi.service');
const { fromJid, samePhone } = require('../utils/phone');
const whatsapp = require('../services/whatsapp.service');
const { CHECKIN_RE } = require('../services/culto.service');
const { INSCREVER_RE } = require('../services/evento.service');

const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

// Se definida, só mensagens destes números são processadas (ex.: instância pessoal em testes,
// para o assistente nunca responder amigos e família).
const inboundAllowed = (from) => {
  const lista = (process.env.WHATSAPP_INBOUND_ALLOWLIST || '').split(/[,;\s]+/).filter(Boolean);
  return !lista.length || lista.some((n) => samePhone(n, from));
};

// "CHEGUEI <código>" (QR do culto) e "INSCREVER <código>" são pedidos explícitos à igreja, sem IA:
// passam mesmo com a allowlist. O número fica liberado por 30 min para responder o nome que o bot pede.
const COMANDO_PUBLICO_TTL_MS = 30 * 60 * 1000;
const comandoPublicoAte = new Map();
const comandoPublico = (msg) => {
  const agora = Date.now();
  if (CHECKIN_RE.test(msg.text || '') || INSCREVER_RE.test(msg.text || '')) {
    comandoPublicoAte.set(msg.from, agora + COMANDO_PUBLICO_TTL_MS);
    return true;
  }
  const ate = comandoPublicoAte.get(msg.from);
  if (ate && ate < agora) comandoPublicoAte.delete(msg.from);
  return Boolean(ate && ate >= agora);
};

const processLater = (tenant, msg) => {
  if (!inboundAllowed(msg.from) && !comandoPublico(msg)) {
    console.info(`[WEBHOOK] Ignorada: …${String(msg.from).slice(-4)} fora da WHATSAPP_INBOUND_ALLOWLIST`);
    return;
  }
  // Igreja suspensa/cancelada não usa a IA (custo da plataforma), igual ao 402 da API
  if (['suspensa', 'cancelada'].includes(tenant?.status)) return;
  setImmediate(() => runWithTenant(tenant, () => handleInbound(msg))
    .catch((err) => console.error('[WEBHOOK] Erro ao processar:', err)));
};

// ── Evolution API: POST /api/webhooks/evolution/:slug?token=... ──────────
// Modo de teste "conversa consigo mesmo": com WHATSAPP_SELF_CHAT_TEST=true, o que o dono da
// instância escreve no chat com o próprio número (WHATSAPP_NUMERO_INSTANCIA) vira mensagem
// recebida. Respostas do bot nesse chat são ecos e são ignoradas.
const selfChatNumber = () => (process.env.WHATSAPP_SELF_CHAT_TEST === 'true'
  ? String(process.env.WHATSAPP_NUMERO_INSTANCIA || '').replace(/\D/g, '')
  : '');

// Texto e mídia (áudio/imagem) de uma mensagem da Evolution. `seconds` = duração do áudio.
const contentOf = (data) => {
  const m = data.message || {};
  const text = m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.buttonsResponseMessage?.selectedDisplayText
    || m.listResponseMessage?.title
    || '';
  const key = data.key || {};
  let media = null;
  if (m.imageMessage) media = { kind: 'image', ref: key.id, mimetype: m.imageMessage.mimetype, base64: m.base64 || data.base64 };
  if (m.audioMessage) media = { kind: 'audio', ref: key.id, mimetype: m.audioMessage.mimetype, seconds: Number(m.audioMessage.seconds) || null, base64: m.base64 || data.base64 };
  return { text, media };
};

const parseEvolutionMessage = (data) => {
  const key = data?.key || {};
  if (key.fromMe) {
    // Chat consigo mesmo: texto, áudio e foto do dono da instância viram mensagens recebidas.
    const self = selfChatNumber();
    const dest = fromJid(key.remoteJid?.includes('@lid') ? (key.remoteJidAlt || key.senderPn || '') : key.remoteJid);
    if (!self || !dest || !samePhone(dest, self)) return null;
    const { text, media } = contentOf(data);
    if (!text && !media) return null;
    // Ecos do bot: textos e imagens (com legenda) que nós mesmos enviamos.
    if (whatsapp.isOwnEcho({ to: self, text, id: key.id })) return null;
    if (media?.kind === 'image' && whatsapp.isOwnImageEcho(self)) return null;
    return { from: self, messageId: key.id, pushName: data.pushName, text, media };
  }
  let jid = key.remoteJid || '';
  if (jid.endsWith('@g.us') || jid === 'status@broadcast') return null;
  if (jid.includes('@lid')) jid = key.senderPn || key.remoteJidAlt || data.senderPn || '';
  const from = fromJid(jid);
  if (!from) {
    // LID (identificador de privacidade do WhatsApp) sem o número junto: não há como identificar a pessoa
    if (String(key.remoteJid || '').includes('@lid')) console.warn('[WEBHOOK] Mensagem de LID sem número (senderPn/remoteJidAlt): ignorada');
    return null;
  }

  const { text, media } = contentOf(data);
  if (!text && !media) return null;
  return { from, messageId: key.id, pushName: data.pushName, text, media };
};

const evolution = async (req, res) => {
  const tenant = await getTenantBySlug(req.params.slug);
  if (!tenant || !tenant.whatsapp?.webhookToken || !safeEqual(req.query.token, tenant.whatsapp.webhookToken)) {
    return res.status(401).json({ message: 'Webhook não autorizado' });
  }
  res.sendStatus(200);
  if (tenant.whatsapp?.ativo === false) return undefined; // desligado nas configurações: ignora

  const event = String(req.body?.event || '').toLowerCase().replace(/_/g, '.');
  if (event !== 'messages.upsert') return undefined;
  const items = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
  items.map(parseEvolutionMessage).filter(Boolean).forEach((msg) => processLater(tenant, msg));
  return undefined;
};

// ── WhatsApp Cloud API (Meta): GET/POST /api/webhooks/whatsapp ──────────
const cloudVerify = (req, res) => {
  const ok = req.query['hub.mode'] === 'subscribe'
    && process.env.WHATSAPP_VERIFY_TOKEN
    && safeEqual(req.query['hub.verify_token'], process.env.WHATSAPP_VERIFY_TOKEN);
  return ok ? res.status(200).send(req.query['hub.challenge']) : res.sendStatus(403);
};

// Cache só de acertos e com TTL: ids aleatórios não crescem a memória, e troca de número
// na configuração da igreja passa a valer em poucos minutos.
const CLOUD_CACHE_TTL_MS = 5 * 60 * 1000;
const cloudTenantCache = new Map();
const tenantByPhoneNumberId = async (phoneNumberId) => {
  const key = String(phoneNumberId || '');
  if (!key) return null;
  const hit = cloudTenantCache.get(key);
  if (hit && hit.expires > Date.now()) return getTenantById(hit.tenantId);
  const t = await runAsPlatform(() => Tenant.findOne({ 'whatsapp.cloud.phoneNumberId': key }).select('_id').lean());
  if (!t) {
    cloudTenantCache.delete(key);
    return null;
  }
  cloudTenantCache.set(key, { tenantId: t._id, expires: Date.now() + CLOUD_CACHE_TTL_MS });
  return getTenantById(t._id);
};

const cloudReceive = async (req, res) => {
  // Falha fechado: sem o App Secret não há como provar que o POST veio da Meta
  // (qualquer um poderia se passar por um líder pelo número de telefone).
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return res.sendStatus(503);
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody || '').digest('hex')}`;
  if (!safeEqual(req.headers['x-hub-signature-256'], expected)) return res.sendStatus(401);
  res.sendStatus(200);

  for (const entry of req.body?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (!value.messages?.length) continue;
      const tenant = await tenantByPhoneNumberId(value.metadata?.phone_number_id);
      if (!tenant || tenant.whatsapp?.ativo === false) continue;
      const nomes = Object.fromEntries((value.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of value.messages) {
        let text = '';
        let media = null;
        if (m.type === 'text') text = m.text?.body;
        else if (m.type === 'interactive') text = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title;
        else if (m.type === 'button') text = m.button?.text;
        else if (m.type === 'image') {
          text = m.image?.caption || '';
          media = { kind: 'image', ref: m.image?.id, mimetype: m.image?.mime_type };
        } else if (m.type === 'audio') media = { kind: 'audio', ref: m.audio?.id, mimetype: m.audio?.mime_type };
        if (!text && !media) continue;
        processLater(tenant, { from: m.from, messageId: m.id, pushName: nomes[m.from], text, media });
      }
    }
  }
  return undefined;
};

// ── Woovi/OpenPix: POST /api/webhooks/openpix ───────────────────────────
// Uma URL para todos os eventos (CHARGE_COMPLETED, CHARGE_EXPIRED, TRANSACTION_RECEIVED…).
// A conta Woovi é compartilhada com outros produtos: cobrança sem o prefixo do PastorIA (e o
// teste de cadastro do webhook) recebe 200 sem efeito. A baixa nunca confia no corpo: a
// cobrança é consultada na API da Woovi antes.
const openpix = async (req, res) => {
  const body = req.body || {};
  if (!invoiceIdFrom(woovi.correlationIdOf(body))) return res.json({ received: true, ignored: true });
  if (!(await woovi.verifyWebhook(req.rawBody, req.headers))) {
    console.warn('[WEBHOOK] Woovi: assinatura inválida');
    return res.sendStatus(401);
  }
  try {
    const r = await runAsPlatform(() => handleWooviEvent(body));
    return res.json({ received: true, ...r });
  } catch (err) {
    // 5xx: a Woovi reenvia o evento depois
    console.error('[WEBHOOK] Woovi:', err.message);
    return res.status(500).json({ received: false });
  }
};

module.exports = { evolution, cloudVerify, cloudReceive, openpix, parseEvolutionMessage };
