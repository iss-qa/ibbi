const Tenant = require('../models/Tenant.model');
const Invoice = require('../models/Invoice.model');
const UsageCounter = require('../models/UsageCounter.model');
const PlatformUser = require('../models/PlatformUser.model');
const Person = require('../models/Person.model');
const User = require('../models/User.model');
const Message = require('../models/Message.model');
const { signPlatformToken } = require('../middlewares/platformAuth.middleware');
const { PLANS, monthlyPriceFor, getPlan } = require('../config/plans');
const billing = require('../services/billing.service');
const { currentPeriod, iaCusto } = require('../services/usage.service');
const { invalidateTenant } = require('../tenancy/tenant.service');
const { provisionTenant, ProvisionError } = require('../tenancy/provision.service');
const whatsapp = require('../services/whatsapp.service');
const { saveWhatsappConfig } = require('../services/whatsapp-config.service');
const { apresentarNumero } = require('../services/leadership.service');
const { getTenantById } = require('../tenancy/tenant.service');
const { runWithTenant } = require('../tenancy/context');

const DAY_MS = 24 * 60 * 60 * 1000;
const PAYING = ['ativa', 'inadimplente'];

// ── Auth ────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, senha } = req.body || {};
  const admin = await PlatformUser.findOne({ email: String(email || '').trim().toLowerCase() });
  if (!admin || !admin.ativo || !(await admin.comparePassword(String(senha || '')))) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }
  admin.ultimoLoginEm = new Date();
  await admin.save();
  return res.json({ token: signPlatformToken(admin), admin });
};

const me = (req, res) => res.json({ admin: req.platformUser });

// ── Planos ──────────────────────────────────────────────────────────────
const plans = (req, res) => res.json(Object.values(PLANS));

// ── Igrejas (tenants) ───────────────────────────────────────────────────
const lastMonths = (n) => {
  const out = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(x.toISOString().slice(0, 7));
  }
  return out;
};

const listTenants = async (req, res) => {
  const { status, plano, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (plano) filter.plano = plano;
  if (q) filter.$or = [{ nome: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { slug: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
  const tenants = await Tenant.find(filter).sort({ createdAt: -1 }).lean();
  const ids = tenants.map((t) => t._id);
  const [pessoas, usos, vencidas] = await Promise.all([
    Person.aggregate([{ $match: { tenantId: { $in: ids }, status: 'ativo' } }, { $group: { _id: '$tenantId', n: { $sum: 1 } } }]),
    UsageCounter.find({ tenantId: { $in: ids }, periodo: currentPeriod() }).lean(),
    Invoice.aggregate([{ $match: { tenantId: { $in: ids }, status: 'vencido' } }, { $group: { _id: '$tenantId', valor: { $sum: '$valor' }, n: { $sum: 1 } } }]),
  ]);
  const byId = (rows, key = '_id') => new Map(rows.map((r) => [String(r[key]), r]));
  const p = byId(pessoas);
  const u = byId(usos, 'tenantId');
  const v = byId(vencidas);
  res.json(tenants.map((t) => ({
    _id: t._id,
    nome: t.nome,
    slug: t.slug,
    status: t.status,
    plano: t.plano,
    ciclo: t.billing?.ciclo,
    isento: t.billing?.isento,
    mrr: PAYING.includes(t.status) ? monthlyPriceFor(t) : 0,
    cidade: t.cidade,
    uf: t.uf,
    congregacoes: t.congregacoes?.length || 0,
    pessoasAtivas: p.get(String(t._id))?.n || 0,
    whatsappMes: u.get(String(t._id))?.whatsappEnviadas || 0,
    iaMes: u.get(String(t._id))?.iaInteracoes || 0,
    iaCustoMes: iaCusto(u.get(String(t._id)) || {}),
    emAberto: v.get(String(t._id))?.valor || 0,
    trialEndsAt: t.trialEndsAt,
    createdAt: t.createdAt,
  })));
};

const getTenantDetail = async (req, res) => {
  const tenant = await Tenant.findById(req.params.id).lean();
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada' });
  const [faturas, consumo, pessoasAtivas, usuarios, mensagens30d] = await Promise.all([
    Invoice.find({ tenantId: tenant._id }).sort({ competencia: -1 }).lean(),
    UsageCounter.find({ tenantId: tenant._id }).sort({ periodo: -1 }).limit(12).lean(),
    Person.countDocuments({ tenantId: tenant._id, status: 'ativo' }),
    User.countDocuments({ tenantId: tenant._id, ativo: true }),
    Message.countDocuments({ tenantId: tenant._id, criadoEm: { $gte: new Date(Date.now() - 30 * DAY_MS) } }),
  ]);
  // Faturas em aberto anteriores ao link público ganham o token aqui (botão "Copiar link")
  await Promise.all(faturas.filter((f) => !f.publicToken && ['pendente', 'vencido'].includes(f.status))
    .map((f) => billing.ensurePublicToken(f)));
  const { whatsapp: wa, ...rest } = tenant;
  res.json({
    ...rest,
    whatsapp: {
      provider: wa?.provider,
      useEnvFallback: wa?.useEnvFallback,
      numeroIgreja: wa?.numeroIgreja,
      numeroInstancia: wa?.numeroInstancia || (wa?.useEnvFallback ? process.env.WHATSAPP_NUMERO_INSTANCIA || '' : ''),
      apresentacaoEnviadaEm: wa?.apresentacaoEnviadaEm,
      evolution: wa?.useEnvFallback && !wa?.evolution?.apiKeyEnc
        ? { url: process.env.EVOLUTION_API_URL, instance: process.env.EVOLUTION_INSTANCE, configurada: Boolean(process.env.EVOLUTION_API_KEY), origem: 'servidor (.env)' }
        : { url: wa?.evolution?.url, instance: wa?.evolution?.instance, configurada: Boolean(wa?.evolution?.apiKeyEnc), origem: 'igreja' },
    },
    mrr: PAYING.includes(tenant.status) ? monthlyPriceFor(tenant) : 0,
    precoPlano: monthlyPriceFor({ ...tenant, billing: { ...tenant.billing, isento: false } }),
    faturas,
    consumo: consumo.map((c) => ({ ...c, iaCusto: iaCusto(c) })),
    pessoasAtivas,
    usuarios,
    mensagens30d,
  });
};

// Onboarding de nova igreja + usuário master inicial.
const createTenant = async (req, res) => {
  try {
    const { tenant, credenciais } = await provisionTenant(req.body || {}, { origem: req.body?.origem || 'painel' });
    return res.status(201).json({ tenant, credenciais });
  } catch (err) {
    if (err instanceof ProvisionError) return res.status(err.status).json({ message: err.message, sugestao: err.sugestao });
    throw err;
  }
};

const updateTenant = async (req, res) => {
  const b = req.body || {};
  const tenant = await Tenant.findById(req.params.id);
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada' });
  ['nome', 'nomeCurto', 'email', 'telefone', 'responsavel', 'cidade', 'uf', 'timezone', 'plano', 'trialEndsAt']
    .forEach((k) => { if (b[k] !== undefined) tenant[k] = b[k]; });
  if (b.billing) {
    ['ciclo', 'valorMensal', 'diaVencimento', 'isento'].forEach((k) => {
      if (b.billing[k] !== undefined) tenant.billing[k] = b.billing[k] === '' ? undefined : b.billing[k];
    });
  }
  if (b.limitesCustom) tenant.limitesCustom = b.limitesCustom;
  const cobranca = require('../utils/cobranca').dadosCobranca(b);
  if (cobranca.erro) return res.status(400).json({ message: cobranca.erro });
  Object.assign(tenant, cobranca.set);
  if (b.status) {
    tenant.status = b.status;
    if (b.status === 'cancelada') {
      tenant.canceladaEm = new Date();
      tenant.motivoCancelamento = b.motivoCancelamento;
    }
  }
  try {
    await tenant.save();
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
  invalidateTenant(tenant._id);
  // Plano/valor/ciclo/isenção alterados pela plataforma: a fatura em aberto do mês acompanha
  if (b.plano || b.billing) {
    await billing.repriceOpenInvoices(tenant.toObject()).catch((err) => console.error('[BILLING] Reajuste:', err.message));
    // Status escolhido à mão pela plataforma prevalece
    if (!b.status) await billing.recomputeStatus(tenant._id).catch(() => {});
  }
  return res.json(tenant);
};

// ── WhatsApp da igreja (instância) ────────────────────────────────────────
const updateTenantWhatsapp = async (req, res) => {
  try {
    const { tenant, mudou } = await saveWhatsappConfig(req.params.id, req.body || {});
    return res.json({ ok: true, mudou, provider: tenant.whatsapp.provider, instancia: tenant.whatsapp.evolution?.instance, numeroInstancia: tenant.whatsapp.numeroInstancia });
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message });
  }
};

const testTenantWhatsapp = async (req, res) => {
  const tenant = await getTenantById(req.params.id);
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada' });
  return runWithTenant(tenant, async () => {
    if (!whatsapp.isConfigured()) return res.json({ online: false, configurado: false });
    const estado = await whatsapp.connectionState().catch((err) => ({ online: false, error: err.message }));
    return res.json({ configurado: true, ...whatsapp.getProvider().describe(), ...estado });
  });
};

const apresentarTenantWhatsapp = async (req, res) => {
  const tenant = await getTenantById(req.params.id);
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada' });
  try {
    return res.json(await runWithTenant(tenant, () => apresentarNumero({ forcar: Boolean(req.body?.forcar) })));
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// ── Faturas ─────────────────────────────────────────────────────────────
const listInvoices = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.tenantId) filter.tenantId = req.query.tenantId;
  if (req.query.competencia) filter.competencia = req.query.competencia;
  const invoices = await Invoice.find(filter).sort({ vencimento: -1 }).limit(500).populate('tenantId', 'nome slug').lean();
  res.json(invoices);
};

const generateTenantInvoice = async (req, res) => {
  const tenant = await Tenant.findById(req.params.id).lean();
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada' });
  const { invoice, criada } = await billing.generateInvoice(tenant, req.body?.competencia || billing.competenciaOf());
  if (!invoice) return res.status(400).json({ message: 'Igreja isenta ou com valor zero' });
  return res.status(criada ? 201 : 200).json(invoice);
};

const payInvoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Fatura não encontrada' });
  const { valorPago, metodo, pagoEm, observacao } = req.body || {};
  res.json(await billing.markPaid(invoice, { valorPago, metodo, pagoEm: pagoEm ? new Date(pagoEm) : undefined, observacao }));
};

const cancelInvoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Fatura não encontrada' });
  return res.json(await billing.cancelInvoice(invoice, req.body?.observacao));
};

// Gera (ou renova) o Pix da fatura na Woovi.
const chargeInvoice = async (req, res) => {
  if (!billing.gatewayEnabled()) return res.status(400).json({ message: 'Woovi não configurada (WOOVI_ENV + WOOVI_PROD_APP_ID/WOOVI_SANDBOX_APP_ID)' });
  const invoice = await Invoice.findById(req.params.id);
  const tenant = invoice && await Tenant.findById(invoice.tenantId).lean();
  if (!invoice || !tenant) return res.status(404).json({ message: 'Fatura não encontrada' });
  try {
    return res.json(await billing.createGatewayCharge(invoice, tenant, { throwOnError: true }));
  } catch (err) {
    return res.status(502).json({ message: err.message });
  }
};

// Reenvia o email da fatura (Pix + boleto + link de pagamento) ao email de cobrança da igreja.
const emailInvoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  const tenant = invoice && await Tenant.findById(invoice.tenantId).lean();
  if (!invoice || !tenant) return res.status(404).json({ message: 'Fatura não encontrada' });
  if (!['pendente', 'vencido'].includes(invoice.status)) return res.status(400).json({ message: 'Só faturas em aberto são enviadas.' });
  if (!(tenant.emailCobranca || tenant.email)) return res.status(400).json({ message: 'A igreja não tem email cadastrado.' });
  const atual = billing.gatewayEnabled() ? await billing.createGatewayCharge(invoice, tenant) : invoice;
  const ok = await billing.sendInvoiceEmail(tenant, atual, atual.status === 'vencido' ? 'vencida' : 'lembrete');
  if (!ok) return res.status(502).json({ message: 'Falha ao enviar o email (verifique o SMTP).' });
  return res.json({ ok: true, para: tenant.emailCobranca || tenant.email, pagarUrl: billing.payUrlFor(atual.publicToken) });
};

// Confere o Pix direto na Woovi (webhook perdido).
const syncInvoice = async (req, res) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'Fatura não encontrada' });
  return res.json(await billing.syncCharge(invoice));
};

const runBilling = async (req, res) => res.json(await billing.runBillingCycle());

// ── Consumo de IA detalhado (por chamada) ───────────────────────────────
// GET /ia-uso?tenantId=&periodo=YYYY-MM — sem tenantId: todas as igrejas.
const r4 = (v) => Math.round((Number(v) || 0) * 10000) / 10000;
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const iaUso = async (req, res) => {
  const AiUsageEvent = require('../models/AiUsageEvent.model');
  const pricing = require('../config/ai-pricing');
  const llm = require('../services/ai/llm');
  const periodo = /^\d{4}-\d{2}$/.test(req.query.periodo || '') ? req.query.periodo : currentPeriod();
  const inicio = new Date(`${periodo}-01T00:00:00Z`);
  const fim = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));
  const match = { at: { $gte: inicio, $lt: fim } };
  if (req.query.tenantId) {
    if (!/^[a-f0-9]{24}$/i.test(req.query.tenantId)) return res.status(400).json({ message: 'tenantId inválido' });
    match.tenantId = new (require('mongoose').Types.ObjectId)(req.query.tenantId);
  }
  const soma = {
    chamadas: { $sum: 1 },
    interacoes: { $sum: { $cond: ['$interacao', 1, 0] } },
    input: { $sum: '$inputTokens' },
    cached: { $sum: '$cachedTokens' },
    cacheWrite: { $sum: '$cacheWriteTokens' },
    output: { $sum: '$outputTokens' },
    thinking: { $sum: '$thinkingTokens' },
    audioSeg: { $sum: '$audioSegundos' },
    usd: { $sum: '$custoUsd' },
    brl: { $sum: '$custoBrl' },
    msMedio: { $avg: '$ms' },
  };
  const [porModelo, porOperacao, ultimas] = await Promise.all([
    AiUsageEvent.aggregate([{ $match: match }, { $group: { _id: { provider: '$provider', modelo: '$modelVersion' }, ...soma } }, { $sort: { usd: -1 } }]),
    AiUsageEvent.aggregate([{ $match: match }, { $group: { _id: '$operacao', ...soma } }, { $sort: { usd: -1 } }]),
    AiUsageEvent.find(match).sort({ at: -1 }).limit(Math.min(Number(req.query.limite) || 25, 100)).populate('tenantId', 'nome slug').lean(),
  ]);
  const fmt = (g) => ({
    chamadas: g.chamadas, interacoes: g.interacoes, input: g.input, cached: g.cached, cacheWrite: g.cacheWrite,
    output: g.output, thinking: g.thinking, audioMin: r2(g.audioSeg / 60),
    cachePct: g.input ? Math.round((g.cached / g.input) * 100) : 0,
    usd: r4(g.usd), brl: r2(g.brl), msMedio: Math.round(g.msMedio || 0),
  });
  const totais = porModelo.reduce((t, g) => {
    Object.keys(soma).forEach((k) => { if (k !== 'msMedio') t[k] = (t[k] || 0) + (g[k] || 0); });
    return t;
  }, {});
  await pricing.refreshUsdBrl().catch(() => {});
  const provider = llm.provider();
  return res.json({
    periodo,
    cotacao: pricing.usdBrlInfo(),
    ativo: provider ? {
      provider,
      providerNome: pricing.PROVIDER_LABEL[provider] || provider,
      modelo: llm.modelName(),
      preco: pricing.priceFor(llm.modelName()),
      transcricao: process.env.TRANSCRIPTION_API_KEY
        ? { modelo: process.env.TRANSCRIPTION_MODEL || 'whisper-1', usdMin: Number(process.env.TRANSCRIPTION_PRICE_USD_MIN) || pricing.AUDIO_PRICES[process.env.TRANSCRIPTION_MODEL || 'whisper-1'] || null }
        : { modelo: provider === 'gemini' ? llm.modelName() : null, viaGemini: provider === 'gemini' },
    } : null,
    totais: { ...fmt({ ...totais, msMedio: 0 }), chamadas: totais.chamadas || 0 },
    porModelo: porModelo.map((g) => ({
      provider: g._id.provider,
      providerNome: pricing.PROVIDER_LABEL[g._id.provider] || g._id.provider,
      modelo: g._id.modelo,
      preco: pricing.priceFor(g._id.modelo) || null,
      ...fmt(g),
    })),
    porOperacao: porOperacao.map((g) => ({ operacao: g._id, ...fmt(g) })),
    ultimas: ultimas.map((e) => ({
      _id: e._id, at: e.at, igreja: e.tenantId?.nome, provider: e.provider, modelo: e.modelVersion || e.model, operacao: e.operacao,
      input: e.inputTokens, cached: e.cachedTokens, cacheWrite: e.cacheWriteTokens, output: e.outputTokens, thinking: e.thinkingTokens,
      audioSeg: e.audioSegundos, usd: r4(e.custoUsd), brl: r4(e.custoBrl), usdBrl: e.usdBrl, ms: e.ms,
    })),
  });
};

// ── Métricas ────────────────────────────────────────────────────────────
const metrics = async (req, res) => {
  const meses = lastMonths(12);
  const inicio12 = new Date(`${meses[0]}-01T00:00:00Z`);
  const [tenants, faturamento, recebimentos, emAberto, usoMes, usoHist] = await Promise.all([
    Tenant.find().lean(),
    Invoice.aggregate([
      { $match: { competencia: { $gte: meses[0] }, status: { $ne: 'cancelado' } } },
      { $group: { _id: '$competencia', faturado: { $sum: '$valor' }, recebido: { $sum: { $cond: [{ $eq: ['$status', 'pago'] }, { $ifNull: ['$valorPago', '$valor'] }, 0] } } } },
    ]),
    Invoice.aggregate([
      { $match: { status: 'pago', pagoEm: { $gte: inicio12 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$pagoEm' } }, valor: { $sum: { $ifNull: ['$valorPago', '$valor'] } } } },
    ]),
    Invoice.aggregate([
      { $match: { status: { $in: ['pendente', 'vencido'] } } },
      { $group: { _id: '$status', valor: { $sum: '$valor' }, n: { $sum: 1 } } },
    ]),
    UsageCounter.aggregate([
      { $match: { periodo: currentPeriod() } },
      { $group: { _id: null, whatsapp: { $sum: '$whatsappEnviadas' }, recebidas: { $sum: '$whatsappRecebidas' }, ia: { $sum: '$iaInteracoes' }, tokensIn: { $sum: '$iaInputTokens' }, tokensOut: { $sum: '$iaOutputTokens' } } },
    ]),
    // custo de IA calculado por contador (cada igreja/mês), somado depois
    UsageCounter.find({ periodo: { $gte: meses[0] } }).lean(),
  ]);

  const pagantes = tenants.filter((t) => PAYING.includes(t.status) && !t.billing?.isento);
  const mrr = pagantes.reduce((s, t) => s + monthlyPriceFor(t), 0);
  const count = (fn) => tenants.filter(fn).length;
  const ativosBase = count((t) => ['trial', ...PAYING].includes(t.status));
  const cancel30 = count((t) => t.status === 'cancelada' && t.canceladaEm && Date.now() - new Date(t.canceladaEm) < 30 * DAY_MS);
  const map = (rows, key = 'valor') => new Map(rows.map((r) => [r._id, r[key] ?? r]));
  const fat = new Map(faturamento.map((r) => [r._id, r]));
  const rec = map(recebimentos);
  const uso = new Map();
  usoHist.forEach((c) => {
    const cur = uso.get(c.periodo) || { whatsapp: 0, ia: 0, iaCustoBrl: 0, iaCustoUsd: 0 };
    const custo = iaCusto(c);
    cur.whatsapp += c.whatsappEnviadas || 0;
    cur.ia += c.iaInteracoes || 0;
    cur.iaCustoBrl += custo.brl;
    cur.iaCustoUsd += custo.usd;
    uso.set(c.periodo, cur);
  });
  const custoMes = uso.get(currentPeriod()) || { iaCustoBrl: 0, iaCustoUsd: 0 };
  const novos = new Map();
  tenants.forEach((t) => {
    const k = new Date(t.createdAt).toISOString().slice(0, 7);
    novos.set(k, (novos.get(k) || 0) + 1);
  });
  const aberto = Object.fromEntries(emAberto.map((r) => [r._id, { valor: r.valor, n: r.n }]));

  res.json({
    kpis: {
      mrr,
      arr: mrr * 12,
      arpa: pagantes.length ? Math.round((mrr / pagantes.length) * 100) / 100 : 0,
      igrejasPagantes: pagantes.length,
      igrejasTotal: tenants.length,
      trials: count((t) => t.status === 'trial'),
      trialsExpirando7d: count((t) => t.status === 'trial' && t.trialEndsAt && new Date(t.trialEndsAt) - Date.now() < 7 * DAY_MS),
      inadimplentes: count((t) => t.status === 'inadimplente'),
      suspensas: count((t) => t.status === 'suspensa'),
      churn30d: ativosBase + cancel30 ? Math.round((cancel30 / (ativosBase + cancel30)) * 1000) / 10 : 0,
      emAberto: (aberto.pendente?.valor || 0),
      vencido: (aberto.vencido?.valor || 0),
      faturasVencidas: aberto.vencido?.n || 0,
      recebidoMes: rec.get(currentPeriod()) || 0,
    },
    porStatus: ['trial', 'ativa', 'inadimplente', 'suspensa', 'cancelada'].map((s) => ({ status: s, n: count((t) => t.status === s) })),
    porPlano: Object.keys(PLANS).map((p) => ({
      plano: getPlan(p).nome,
      id: p,
      n: count((t) => t.plano === p && t.status !== 'cancelada'),
      mrr: pagantes.filter((t) => t.plano === p).reduce((s, t) => s + monthlyPriceFor(t), 0),
    })),
    serie: meses.map((m) => ({
      mes: m,
      faturado: fat.get(m)?.faturado || 0,
      recebido: rec.get(m) || 0,
      novasIgrejas: novos.get(m) || 0,
      whatsapp: uso.get(m)?.whatsapp || 0,
      ia: uso.get(m)?.ia || 0,
      iaCustoBrl: Math.round((uso.get(m)?.iaCustoBrl || 0) * 100) / 100,
    })),
    consumoMes: {
      ...(usoMes[0] || { whatsapp: 0, recebidas: 0, ia: 0, tokensIn: 0, tokensOut: 0 }),
      iaCustoUsd: Math.round(custoMes.iaCustoUsd * 100) / 100,
      iaCustoBrl: Math.round(custoMes.iaCustoBrl * 100) / 100,
      margemBrl: Math.round((mrr - custoMes.iaCustoBrl) * 100) / 100,
    },
  });
};

module.exports = {
  login,
  me,
  plans,
  listTenants,
  getTenantDetail,
  createTenant,
  updateTenant,
  listInvoices,
  generateTenantInvoice,
  payInvoice,
  cancelInvoice,
  chargeInvoice,
  syncInvoice,
  emailInvoice,
  runBilling,
  iaUso,
  metrics,
  updateTenantWhatsapp,
  testTenantWhatsapp,
  apresentarTenantWhatsapp,
};
