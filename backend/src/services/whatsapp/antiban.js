const crypto = require('crypto');
const { getTenant } = require('../../tenancy/context');
const { zonedParts } = require('../../utils/time');

/**
 * Regras anti-banimento do WhatsApp (por igreja). Valem para envios iniciados pela igreja
 * (lotes, automações). Respostas a quem escreveu não esperam intervalo, mas contam nos limites.
 * Piso inegociável: 30s entre mensagens de lote.
 */
const FLOOR_SEG = 30;
const DEFAULTS = {
  intervaloMinSeg: Number(process.env.WHATSAPP_MIN_DELAY_SEG) || 45,
  intervaloMaxSeg: Number(process.env.WHATSAPP_MAX_DELAY_SEG) || 90,
  horarioInicio: process.env.WHATSAPP_HORARIO_INICIO || '08:00',
  horarioFim: process.env.WHATSAPP_HORARIO_FIM || '21:00',
  limitePorHora: Number(process.env.WHATSAPP_LIMITE_HORA) || 60,
  limiteDiario: Number(process.env.WHATSAPP_LIMITE_DIA) || 400,
  pausaACada: Number(process.env.WHATSAPP_PAUSA_A_CADA) || 20,
  pausaMin: Number(process.env.WHATSAPP_PAUSA_MIN) || 5,
  digitando: process.env.WHATSAPP_DIGITANDO !== 'false',
  bloquearDuplicadas: true,
};

const config = (tenant = getTenant()) => {
  const c = { ...DEFAULTS, ...Object.fromEntries(Object.entries(tenant?.whatsapp?.antiban || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')) };
  c.intervaloMinSeg = Math.max(FLOOR_SEG, Number(c.intervaloMinSeg));
  c.intervaloMaxSeg = Math.max(c.intervaloMinSeg, Number(c.intervaloMaxSeg));
  return c;
};

const states = new Map(); // tenantId → estado em memória
const stateFor = (tenant) => {
  const id = tenant ? String(tenant._id) : 'env';
  if (!states.has(id)) states.set(id, { lastBulkAt: 0, bulkSeguidos: 0, envios: [], recentes: new Map(), fila: Promise.resolve() });
  return states.get(id);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.round(min + Math.random() * (max - min));
const HOUR = 3600e3;
const DAY = 24 * HOUR;

const prune = (s) => {
  const now = Date.now();
  s.envios = s.envios.filter((t) => now - t < DAY);
  for (const [k, t] of s.recentes) if (now - t > DAY) s.recentes.delete(k);
};

const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
};

// Milissegundos até abrir a janela de envio (0 se já está aberta).
const msUntilWindow = (tenant, c) => {
  const now = zonedParts(tenant?.timezone || 'America/Bahia');
  const atual = now.hour * 60 + now.minute;
  const ini = minutesOf(c.horarioInicio);
  const fim = minutesOf(c.horarioFim);
  if (atual >= ini && atual < fim) return 0;
  const faltam = atual < ini ? ini - atual : 24 * 60 - atual + ini;
  return faltam * 60e3;
};

class AntiBanError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/**
 * Aguarda a vez de um envio em lote: janela de horário, intervalo aleatório desde o último
 * envio, pausa longa a cada N mensagens e limites por hora/dia. Serializado por igreja.
 */
const paceBulk = (tenant = getTenant()) => {
  const s = stateFor(tenant);
  const turno = s.fila.then(async () => {
    const c = config(tenant);
    prune(s);
    if (s.envios.length >= c.limiteDiario) {
      throw new AntiBanError(`Limite diário de ${c.limiteDiario} mensagens atingido (proteção anti-bloqueio).`, 'ANTIBAN_DAILY');
    }
    const espera = msUntilWindow(tenant, c);
    if (espera > 0) {
      console.log(`[ANTIBAN] Fora do horário (${c.horarioInicio}–${c.horarioFim}); aguardando ${Math.round(espera / 60e3)} min.`);
      await sleep(espera);
    }
    const naHora = s.envios.filter((t) => Date.now() - t < HOUR);
    if (naHora.length >= c.limitePorHora) await sleep(HOUR - (Date.now() - naHora[0]) + 1000);
    if (s.bulkSeguidos > 0 && c.pausaACada && s.bulkSeguidos % c.pausaACada === 0) await sleep(c.pausaMin * 60e3);
    const intervalo = rand(c.intervaloMinSeg, c.intervaloMaxSeg) * 1000;
    const decorrido = Date.now() - s.lastBulkAt;
    if (s.lastBulkAt && decorrido < intervalo) await sleep(intervalo - decorrido);
    s.lastBulkAt = Date.now();
    s.bulkSeguidos += 1;
  });
  s.fila = turno.catch(() => {});
  return turno;
};

const fingerprint = (number, text) => crypto.createHash('sha1').update(`${number}|${String(text).trim()}`).digest('hex');

// Mesmo texto para o mesmo número nas últimas 24h?
const isDuplicate = (number, text, tenant = getTenant()) => {
  if (!config(tenant).bloquearDuplicadas || !text) return false;
  const s = stateFor(tenant);
  prune(s);
  return s.recentes.has(fingerprint(number, text));
};

const record = (number, text, tenant = getTenant()) => {
  const s = stateFor(tenant);
  s.envios.push(Date.now());
  if (text) s.recentes.set(fingerprint(number, text), Date.now());
};

// "Digitando…" antes da mensagem (Evolution): 1,5–4s conforme o tamanho do texto.
const typingMs = (text, tenant = getTenant()) => (config(tenant).digitando
  ? Math.min(4000, 1500 + Math.round(String(text || '').length * 8) + rand(0, 500))
  : 0);

const stats = (tenant = getTenant()) => {
  const s = stateFor(tenant);
  prune(s);
  const c = config(tenant);
  return {
    regras: c,
    ultimaHora: s.envios.filter((t) => Date.now() - t < HOUR).length,
    ultimas24h: s.envios.length,
    dentroDoHorario: msUntilWindow(tenant, c) === 0,
  };
};

module.exports = { DEFAULTS, FLOOR_SEG, config, paceBulk, isDuplicate, record, typingMs, stats, AntiBanError };
