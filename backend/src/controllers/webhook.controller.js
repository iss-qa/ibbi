const crypto = require('crypto');
const Tenant = require('../models/Tenant.model');
const { runAsPlatform, runWithTenant } = require('../tenancy/context');
const { getTenantBySlug, getTenantById } = require('../tenancy/tenant.service');
const { handleInbound } = require('../services/ai/inbound.service');
const { handleAsaasEvent } = require('../services/billing.service');
const { fromJid, samePhone } = require('../utils/phone');
const whatsapp = require('../services/whatsapp.service');

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

const processLater = (tenant, msg) => {
  if (!inboundAllowed(msg.from)) return;
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
  if (!from) return null;

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

const cloudTenantCache = new Map();
const tenantByPhoneNumberId = async (phoneNumberId) => {
  if (!cloudTenantCache.has(phoneNumberId)) {
    const t = await runAsPlatform(() => Tenant.findOne({ 'whatsapp.cloud.phoneNumberId': phoneNumberId }).select('_id').lean());
    cloudTenantCache.set(phoneNumberId, t?._id || null);
  }
  return getTenantById(cloudTenantCache.get(phoneNumberId));
};

const cloudReceive = async (req, res) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret) {
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(req.rawBody || '').digest('hex')}`;
    if (!safeEqual(req.headers['x-hub-signature-256'], expected)) return res.sendStatus(401);
  }
  res.sendStatus(200);

  for (const entry of req.body?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (!value.messages?.length) continue;
      const tenant = await tenantByPhoneNumberId(value.metadata?.phone_number_id);
      if (!tenant) continue;
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

// ── Asaas: POST /api/webhooks/asaas ─────────────────────────────────────
const asaas = async (req, res) => {
  const token = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!token || !safeEqual(req.headers['asaas-access-token'], token)) return res.sendStatus(401);
  try {
    await runAsPlatform(() => handleAsaasEvent(req.body || {}));
  } catch (err) {
    console.error('[WEBHOOK] Asaas:', err.message);
  }
  return res.json({ received: true });
};

module.exports = { evolution, cloudVerify, cloudReceive, asaas, parseEvolutionMessage };
