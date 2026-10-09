const { createEvolutionProvider } = require('./whatsapp/providers/evolution.provider');
const { createCloudProvider } = require('./whatsapp/providers/cloud.provider');
const { decrypt } = require('../utils/crypto');
const { getTenant, runWithTenant } = require('../tenancy/context');
const usage = require('./usage.service');
const antiban = require('./whatsapp/antiban');

// Regra anti-banimento: piso de 30s entre mensagens de lote (as regras completas ficam em
// whatsapp/antiban.js: intervalo aleatório, horário, limites, duplicidade, "digitando…").
const MIN_DELAY_MS = antiban.FLOOR_SEG * 1000;

const isGroupJid = (input) => String(input || '').includes('@g.us');

const sanitizeNumber = (input) => {
  if (!input) return '';
  if (isGroupJid(input)) return String(input).trim();
  const digits = String(input).replace(/\D/g, '');
  // Só considera o 55 como DDI com 12+ dígitos: "55991234567" é DDD 55 (RS), não DDI.
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
};

// Modo teste: números em MOCK_ALLOWED_NUMBERS recebem de verdade; o resto vai para o mock.
const mockAllowed = () => (process.env.MOCK_ALLOWED_NUMBERS || '')
  .split(/[,;\s]+/).map(sanitizeNumber).filter(Boolean);

const resolveRecipient = (input) => {
  const mock = process.env.MOCK_WHATSAPP_NUMBER;
  const forceMock = process.env.FORCE_MOCK_RECIPIENT === 'true';
  if (forceMock && mock && mockAllowed().includes(sanitizeNumber(input))) return sanitizeNumber(input);
  // Grupos no modo teste: só com MOCK_ALLOW_GROUPS=true (use um grupo de teste)
  if (forceMock && mock && isGroupJid(input) && process.env.MOCK_ALLOW_GROUPS === 'true') return sanitizeNumber(input);
  if (forceMock && mock) {
    console.warn(`[WHATSAPP] ⚠️  MODO MOCK ATIVO — redirecionando ${input} → ${mock}`);
    return sanitizeNumber(mock);
  }
  return sanitizeNumber(input);
};

// ── Descadastro ("SAIR") ─────────────────────────────────────────────
// Regra de ouro: quem pediu para sair NÃO recebe nada até reativar. Toda função de envio
// passa aqui antes do provedor. `ignorarOptOut` só para a confirmação do próprio SAIR.
class OptOutError extends Error {
  constructor(numero) {
    super(`Número ${numero} pediu para não receber mensagens (SAIR). Envio bloqueado.`);
    this.code = 'OPT_OUT';
  }
}
const guardaOptOut = async (number, { ignorarOptOut = false } = {}) => {
  if (ignorarOptOut || isGroupJid(number)) return;
  if (await require('./optout.service').bloqueado(number)) throw new OptOutError(number);
};

// ── Provider por tenant ──────────────────────────────────────────────
const providerCache = new Map(); // tenantId -> { key, provider }

const buildProvider = (tenant) => {
  const wa = tenant?.whatsapp || {};
  const allowSelfSigned = process.env.EVOLUTION_ALLOW_SELF_SIGNED === 'true';

  if (wa.provider === 'cloud') {
    return createCloudProvider({
      phoneNumberId: wa.cloud?.phoneNumberId,
      accessToken: decrypt(wa.cloud?.accessTokenEnc),
      templates: wa.cloud?.templates || {},
    });
  }
  if (wa.provider === 'evolution' && wa.evolution?.apiKeyEnc) {
    return createEvolutionProvider({
      url: wa.evolution.url,
      instance: wa.evolution.instance,
      apiKey: decrypt(wa.evolution.apiKeyEnc),
      allowSelfSigned,
    });
  }
  // Tenant fundador (IBBI) ou ambiente sem tenant: variáveis EVOLUTION_* do .env.
  if (!tenant || wa.useEnvFallback) {
    return createEvolutionProvider({
      url: process.env.EVOLUTION_API_URL,
      instance: process.env.EVOLUTION_INSTANCE,
      apiKey: process.env.EVOLUTION_API_KEY,
      allowSelfSigned,
      trusted: true,
    });
  }
  throw new Error('WhatsApp não configurado para esta igreja');
};

const getProvider = (tenant = getTenant()) => {
  const id = tenant ? String(tenant._id) : 'env';
  const key = JSON.stringify(tenant?.whatsapp || {});
  const hit = providerCache.get(id);
  if (hit && hit.key === key) return hit.provider;
  const provider = buildProvider(tenant);
  providerCache.set(id, { key, provider });
  return provider;
};

const isConfigured = (tenant = getTenant()) => {
  try {
    getProvider(tenant);
    return true;
  } catch {
    return false;
  }
};

// Todo envio passa por aqui: limite do plano + medição de consumo.
const metered = async (fn) => {
  await usage.assertWithinLimit('whatsappMensagensMes');
  try {
    const result = await fn(getProvider());
    await usage.increment({ whatsappEnviadas: 1 });
    return result;
  } catch (err) {
    await usage.increment({ whatsappErros: 1 });
    throw err;
  }
};

/**
 * Texto. `bulk: true` = envio iniciado pela igreja (lote/automação): respeita o ritmo anti-ban
 * (intervalo aleatório, horário, limites) e não repete o mesmo texto ao mesmo número em 24h.
 * Sem `bulk` (respostas a quem escreveu) não espera, mas conta nos limites.
 */
// Eco do próprio bot: no modo "conversa consigo mesmo" as respostas voltam pelo webhook
// como mensagens fromMe. Guardamos texto e id do que enviamos para ignorá-las.
const ECHO_TTL = 5 * 60e3;
const echoes = new Map(); // chave → expira em
const echoKey = (to, text) => `${sanitizeNumber(to)}|${String(text || '').trim().slice(0, 500)}`;
const rememberEcho = (key) => {
  const now = Date.now();
  for (const [k, exp] of echoes) if (exp < now) echoes.delete(k);
  echoes.set(key, now + ECHO_TTL);
};
const isOwnEcho = ({ to, text, id }) => {
  const now = Date.now();
  return [id && `id|${id}`, echoKey(to, text)].some((k) => k && echoes.get(k) > now);
};

const sendText = async (number, text, { bulk = false, ignorarOptOut = false } = {}) => {
  await guardaOptOut(number, { ignorarOptOut });
  const to = resolveRecipient(number);
  if (bulk) {
    if (antiban.isDuplicate(to, text)) {
      console.warn(`[ANTIBAN] Mensagem repetida para ${to} nas últimas 24h — não reenviada.`);
      return { skipped: true, motivo: 'duplicada' };
    }
    await antiban.paceBulk();
  }
  rememberEcho(echoKey(to, text));
  const result = await metered((p) => p.sendText(to, text, { typingMs: antiban.typingMs(text) }));
  if (result?.key?.id) rememberEcho(`id|${result.key.id}`);
  antiban.record(to, text);
  return result;
};
// Imagens também ecoam no chat consigo mesmo: marca o envio por alguns segundos e guarda o id.
const IMAGE_ECHO_MS = 20e3;
const sendImage = async (number, media, caption = '') => {
  await guardaOptOut(number);
  const to = resolveRecipient(number);
  echoes.set(`img|${sanitizeNumber(to)}`, Date.now() + IMAGE_ECHO_MS);
  if (caption) rememberEcho(echoKey(to, caption));
  const result = await metered((p) => p.sendImage(to, media, caption));
  if (result?.key?.id) rememberEcho(`id|${result.key.id}`);
  return result;
};
const isOwnImageEcho = (to) => echoes.get(`img|${sanitizeNumber(to)}`) > Date.now();
const sendAudio = async (number, media) => {
  await guardaOptOut(number);
  return metered((p) => p.sendAudio(resolveRecipient(number), media));
};
const sendButtons = async (number, text, buttons) => {
  await guardaOptOut(number);
  return metered((p) => p.sendButtons(resolveRecipient(number), text, buttons));
};

const sendContact = async (number, contato) => {
  await guardaOptOut(number);
  return metered((p) => (p.sendContact ? p.sendContact(resolveRecipient(number), contato) : null));
};

// Assinatura legada: sendMedia(numero, legenda, url|base64)
const sendMedia = (number, caption, media) => sendImage(number, media, caption);

/**
 * Mensagem iniciada pela igreja (aniversário, ausência, aviso).
 * Na API oficial, fora da janela de 24h, usa o template aprovado configurado em
 * whatsapp.cloud.templates[templateKey] com `templateParams` como variáveis do corpo.
 */
const sendProactive = async ({ number, text, templateKey, templateParams = [], lastInboundAt }) => {
  await guardaOptOut(number);
  const provider = getProvider();
  const inWindow = lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 23 * 60 * 60 * 1000;
  const templateName = provider.templates?.[templateKey];
  if (provider.requiresTemplates && !inWindow && templateName) {
    await antiban.paceBulk();
    return metered((p) => p.sendTemplate(resolveRecipient(number), templateName, templateParams));
  }
  return sendText(number, text, { bulk: true });
};

// Para laços de envio fora da fila (aniversários, ausências): aguarda a vez anti-ban.
const paceBulk = () => antiban.paceBulk();
const antibanStats = () => antiban.stats();

const getMediaBase64 = (ref) => getProvider().getMediaBase64(ref);

const supportsGroups = (tenant = getTenant()) => {
  try { return Boolean(getProvider(tenant).supportsGroups); } catch { return false; }
};
const listGroups = () => {
  const p = getProvider();
  if (!p.listGroups) throw new Error('Grupos só estão disponíveis com a Evolution API (WhatsApp não oficial).');
  return p.listGroups();
};
const createGroup = (nome, numeros, descricao) => {
  const p = getProvider();
  if (!p.createGroup) throw new Error('Grupos só estão disponíveis com a Evolution API (WhatsApp não oficial).');
  return p.createGroup(nome, [...new Set(numeros.map(sanitizeNumber))], descricao);
};
const connectionState = (tenant = getTenant()) => getProvider(tenant).connectionState();

// ── Fila FIFO por tenant (cada igreja tem seu próprio número/ritmo) ──────
class WhatsAppQueue {
  constructor(tenant) {
    this.tenant = tenant;
    this.queue = [];
    this.isProcessing = false;
    this.canceled = false;
    this.generation = 0; // muda a cada cancelamento: o laço em andamento para no próximo job
    this.total = 0;
    this.sent = 0;
    this.errors = 0;
    this.lastSentAt = null;
  }

  getStatus() {
    return {
      total: this.total,
      enviado: this.sent,
      erro: this.errors,
      status: this.isProcessing ? 'enviando' : 'parado',
      pendente: this.queue.length,
    };
  }

  cancel() {
    const descartados = this.queue;
    this.queue = [];
    this.canceled = true;
    this.generation += 1;
    // Quem estava na fila recebe onError: logs/estados não ficam "enviando" para sempre
    const motivo = new Error('Envio cancelado');
    const notificar = async () => {
      for (const job of descartados) {
        try { if (job.onError) await job.onError(motivo); } catch (err) { console.error('[WHATSAPP] onError (cancelamento):', err.message); }
      }
    };
    (this.tenant ? runWithTenant(this.tenant, notificar) : notificar()).catch(() => {});
  }

  async runJob(job) {
    const exec = async () => {
      try {
        // Descadastrado: falha na hora, sem gastar o intervalo anti-ban da fila.
        if (job.number) await guardaOptOut(job.number);
        if (job.onStart) await job.onStart();
        let result;
        if (job.send) {
          await antiban.paceBulk();
          result = await job.send();
        } else {
          result = await sendText(job.number, job.text, { bulk: true });
        }
        // Duplicada barrada pelo anti-ban: nada saiu — não conta nem registra como enviada
        if (result?.skipped) throw new Error('Mensagem idêntica enviada há pouco para este número (bloqueada pelo anti-ban)');
        this.sent += 1;
        this.lastSentAt = Date.now();
      } catch (err) {
        this.errors += 1;
        this.lastSentAt = Date.now();
        // Falha dentro do onError (ex.: Mongo fora) não pode travar a fila da igreja
        try { if (job.onError) await job.onError(err); } catch (e) { console.error('[WHATSAPP] onError falhou:', e.message); }
        return;
      }
      try { if (job.onSuccess) await job.onSuccess(); } catch (e) { console.error('[WHATSAPP] onSuccess falhou:', e.message); }
    };
    return this.tenant ? runWithTenant(this.tenant, exec) : exec();
  }

  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    this.canceled = false;
    const gen = this.generation;

    try {
      while (this.queue.length > 0 && gen === this.generation) {
        const job = this.queue.shift();
        // O ritmo (intervalo aleatório, horário, limites) é aplicado em runJob pelo antiban.
        await this.runJob(job);
      }
    } finally {
      // Sempre libera a fila (erro inesperado não pode deixá-la "enviando" até reiniciar)
      this.isProcessing = false;
    }
    // Jobs enfileirados depois de um cancelamento, enquanto o laço antigo terminava o job em curso
    if (this.queue.length > 0) await this.processNext();
  }

  enqueueBatch(jobs) {
    this.total += jobs.length;
    this.queue.push(...jobs);
    this.processNext().catch((err) => console.error('[WHATSAPP] Erro na fila:', err));
  }
}

const queues = new Map();
const getQueue = () => {
  const tenant = getTenant();
  const id = tenant ? String(tenant._id) : 'env';
  if (!queues.has(id)) queues.set(id, new WhatsAppQueue(tenant));
  const q = queues.get(id);
  if (tenant) q.tenant = tenant; // mantém config atualizada
  return q;
};

const sendSingle = async (celular, mensagem) => {
  await sendText(celular, mensagem);
};

const sendBatch = async (destinatarios, mensagem, handlers = {}) => {
  const getText = typeof mensagem === 'function' ? mensagem : () => mensagem;
  const normalizedHandlers = typeof handlers === 'function'
    ? { onProgress: handlers }
    : handlers || {};
  const jobs = destinatarios.map((dest) => ({
    number: dest.celular,
    text: getText(dest),
    onStart: () => normalizedHandlers.onStart && normalizedHandlers.onStart(dest),
    onSuccess: async () => {
      if (normalizedHandlers.onSuccess) await normalizedHandlers.onSuccess(dest);
      if (normalizedHandlers.onProgress) await normalizedHandlers.onProgress(dest, null);
    },
    onError: async (err) => {
      if (normalizedHandlers.onError) await normalizedHandlers.onError(dest, err);
      if (normalizedHandlers.onProgress) await normalizedHandlers.onProgress(dest, err);
    },
  }));

  getQueue().enqueueBatch(jobs);
};

// Enfileira jobs genéricos ({ send, onSuccess, onError }) respeitando o delay anti-banimento.
const enqueue = (jobs) => getQueue().enqueueBatch(jobs);

const cancelQueue = () => getQueue().cancel();
const getQueueStatus = () => getQueue().getStatus();

module.exports = {
  MIN_DELAY_MS,
  sanitizeNumber,
  isGroupJid,
  getProvider,
  isConfigured,
  sendSingle,
  sendText,
  sendBatch,
  sendImage,
  sendAudio,
  sendButtons,
  sendMedia,
  sendProactive,
  sendContact,
  isOwnEcho,
  OptOutError,
  isOwnImageEcho,
  paceBulk,
  antibanStats,
  getMediaBase64,
  connectionState,
  supportsGroups,
  listGroups,
  createGroup,
  enqueue,
  cancelQueue,
  getQueueStatus,
};
