const UsageCounter = require('../models/UsageCounter.model');
const { limitFor } = require('../config/plans');
const { getTenantId, getTenant } = require('../tenancy/context');

const currentPeriod = (date = new Date()) => date.toISOString().slice(0, 7);

const increment = async (fields, tenantId = getTenantId()) => {
  if (!tenantId) return;
  try {
    await UsageCounter.updateOne(
      { tenantId, periodo: currentPeriod() },
      { $inc: fields },
      { upsert: true },
    );
  } catch (err) {
    console.error('[USAGE] Falha ao registrar consumo:', err.message);
  }
};

const getUsage = async (tenantId = getTenantId(), periodo = currentPeriod()) => {
  const row = await UsageCounter.findOne({ tenantId, periodo }).lean();
  return row || { tenantId, periodo, whatsappEnviadas: 0, iaInteracoes: 0, iaInputTokens: 0, iaOutputTokens: 0 };
};

const USAGE_FIELD = {
  whatsappMensagensMes: 'whatsappEnviadas',
  iaInteracoesMes: 'iaInteracoes',
};

// Lança 429 quando o limite mensal do plano foi atingido. `null` = ilimitado.
const assertWithinLimit = async (limit, tenant = getTenant()) => {
  if (!tenant) return;
  const max = limitFor(tenant, limit);
  if (max === null || max === undefined) return;
  const usage = await getUsage(tenant._id);
  if ((usage[USAGE_FIELD[limit]] || 0) >= max) {
    const err = new Error(limit === 'iaInteracoesMes'
      ? 'Limite mensal de interações de IA do plano atingido.'
      : 'Limite mensal de mensagens WhatsApp do plano atingido.');
    err.status = 429;
    err.code = 'PLAN_LIMIT';
    throw err;
  }
};

// Custo de IA de um contador mensal. Meses anteriores ao registro por chamada (sem iaCustoUsd)
// são estimados pelos tokens e pelo preço vigente no fim do mês (sem desconto de cache).
const iaCusto = (c = {}) => {
  const { costUsd, usdBrl } = require('../config/ai-pricing');
  const model = process.env.AI_PROVIDER === 'anthropic' ? process.env.AI_MODEL : (process.env.GEMINI_MODEL || 'gemini-3.8-flash');
  const registrado = Number(c.iaCustoUsd) || 0;
  const estimado = !registrado && (c.iaInputTokens || c.iaOutputTokens);
  const usd = registrado || costUsd({
    model, input: c.iaInputTokens, cached: c.iaCachedTokens, output: c.iaOutputTokens,
    date: c.periodo ? new Date(`${c.periodo}-28T12:00:00Z`) : new Date(),
  });
  const r2 = (v) => Math.round(v * 100) / 100;
  return {
    usd: Math.round(usd * 10000) / 10000,
    brl: r2(usd * usdBrl()),
    estimado: Boolean(estimado),
    cachePct: c.iaInputTokens ? Math.round(((c.iaCachedTokens || 0) / c.iaInputTokens) * 100) : 0,
    porInteracaoBrl: c.iaInteracoes ? Math.round(((usd * usdBrl()) / c.iaInteracoes) * 1000) / 1000 : 0,
  };
};

module.exports = {
  iaCusto, currentPeriod, increment, getUsage, assertWithinLimit };
