const Tenant = require('../models/Tenant.model');
const Invoice = require('../models/Invoice.model');
const Person = require('../models/Person.model');
const whatsapp = require('../services/whatsapp.service');
const usage = require('../services/usage.service');
const { sendEmail } = require('../services/email.service');
const { PLANS, hasFeature, getPlan } = require('../config/plans');
const { randomToken } = require('../utils/crypto');
const { applyWhatsappConfig, apresentarSeConectado } = require('../services/whatsapp-config.service');
const { apresentarNumero } = require('../services/leadership.service');
const { invalidateTenant, getTenantById, serializeForTenantAdmin } = require('../tenancy/tenant.service');
const { runWithTenant } = require('../tenancy/context');

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

const get = async (req, res) => {
  const [consumo, pessoasAtivas] = await Promise.all([
    usage.getUsage(req.tenant._id),
    Person.countDocuments({ status: 'ativo' }),
  ]);
  res.json({ ...serializeForTenantAdmin(req.tenant), consumo, pessoasAtivas });
};

// Atualização das configurações pela própria igreja (master).
const updateSettings = async (req, res) => {
  const body = req.body || {};
  const tenant = await Tenant.findById(req.tenant._id);
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada' });

  Object.assign(tenant, pick(body, ['nome', 'nomeCurto', 'email', 'telefone', 'responsavel', 'timezone', 'programacaoSemanal']));
  if (Array.isArray(body.congregacoes)) {
    const lista = [...new Set(body.congregacoes.map((c) => String(c).trim()).filter(Boolean))];
    if (!lista.length) return res.status(400).json({ message: 'Informe ao menos uma congregação' });
    tenant.congregacoes = lista;
  }
  if (body.branding) tenant.branding = { ...tenant.branding?.toObject?.(), ...pick(body.branding, ['logoUrl', 'corPrimaria', 'corSecundaria', 'assinatura', 'portalUrl']) };
  if (body.automacoes) tenant.automacoes = body.automacoes;
  if (body.ia) tenant.ia = { ...tenant.ia?.toObject?.(), ...pick(body.ia, ['ativo', 'nomeAssistente', 'tom', 'cadastroPublico', 'instrucoesExtras']) };
  if (Array.isArray(body.lideranca)) tenant.lideranca = body.lideranca;
  if (Array.isArray(body.ebdLideres)) tenant.ebdLideres = body.ebdLideres;

  let whatsappMudou = false;
  if (body.whatsapp) {
    const w = body.whatsapp;
    try {
      whatsappMudou = applyWhatsappConfig(tenant, w);
    } catch (err) {
      return res.status(err.status || 400).json({ message: err.message });
    }
    if (w.grupoLideranca !== undefined) tenant.whatsapp.grupoLideranca = w.grupoLideranca?.jid ? { jid: w.grupoLideranca.jid, nome: w.grupoLideranca.nome } : undefined;
    if (w.liderancaEnvio) tenant.whatsapp.liderancaEnvio = w.liderancaEnvio;
    if (w.antiban) {
      const a = w.antiban;
      const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
      tenant.whatsapp.antiban = {
        intervaloMinSeg: Math.max(30, num(a.intervaloMinSeg) || 45),
        intervaloMaxSeg: Math.max(Math.max(30, num(a.intervaloMinSeg) || 45), num(a.intervaloMaxSeg) || 90),
        horarioInicio: a.horarioInicio || '08:00',
        horarioFim: a.horarioFim || '21:00',
        limitePorHora: num(a.limitePorHora),
        limiteDiario: num(a.limiteDiario),
        pausaACada: num(a.pausaACada),
        pausaMin: num(a.pausaMin),
        digitando: a.digitando !== false,
      };
    }
  }
  if (!tenant.whatsapp.webhookToken) tenant.whatsapp.webhookToken = randomToken(20);

  try {
    await tenant.save();
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
  invalidateTenant(tenant._id);
  if (whatsappMudou) apresentarSeConectado(tenant._id).catch((err) => console.error('[WHATSAPP] Apresentação automática:', err.message));
  return res.json(serializeForTenantAdmin(tenant.toObject()));
};

// "Salve nosso contato" para toda a liderança (manual; forcar=true reenvia).
const apresentar = async (req, res) => {
  try {
    return res.json(await apresentarNumero({ forcar: Boolean(req.body?.forcar) }));
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const whatsappStatus = async (req, res) => {
  if (!whatsapp.isConfigured(req.tenant)) return res.json({ online: false, configurado: false });
  const state = await whatsapp.connectionState(req.tenant).catch((err) => ({ online: false, error: err.message }));
  return res.json({ configurado: true, ...whatsapp.getProvider(req.tenant).describe(), ...state, antiban: whatsapp.antibanStats() });
};

const whatsappTest = async (req, res) => {
  const numero = req.body?.numero;
  if (!numero) return res.status(400).json({ message: 'Informe o número' });
  try {
    await whatsapp.sendText(numero, `✅ Teste de conexão — ${req.tenant.nome}. Seu WhatsApp está pronto para as automações!`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const listGroups = async (req, res) => {
  try {
    return res.json(await whatsapp.listGroups());
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// Cria o grupo da liderança com os contatos de Configurações → Liderança (ou os informados).
const createGroup = async (req, res) => {
  const nome = String(req.body?.nome || `Liderança ${req.tenant.nomeCurto || req.tenant.nome}`).slice(0, 100);
  const numeros = (req.body?.participantes?.length ? req.body.participantes : (req.tenant.lideranca || []).map((l) => l.celular))
    .filter((n) => n && !whatsapp.isGroupJid(n));
  if (!numeros.length) return res.status(400).json({ message: 'Cadastre ao menos um contato da liderança com WhatsApp.' });
  try {
    const grupo = await whatsapp.createGroup(nome, numeros, `Avisos automáticos da ${req.tenant.nome}: aniversários, ausências e relatório semanal.`);
    if (!grupo.jid) return res.status(502).json({ message: 'A Evolution não retornou o identificador do grupo.' });
    await Tenant.updateOne({ _id: req.tenant._id }, { $set: { 'whatsapp.grupoLideranca': grupo, 'whatsapp.liderancaEnvio': req.body?.modo || 'grupo' } });
    invalidateTenant(req.tenant._id);
    return res.status(201).json(grupo);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

const webhookInfo = (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const token = req.tenant.whatsapp?.webhookToken;
  res.json({
    evolution: token ? `${base}/api/webhooks/evolution/${req.tenant.slug}?token=${token}` : null,
    evolutionEventos: ['MESSAGES_UPSERT'],
    cloud: `${base}/api/webhooks/whatsapp`,
    cloudVerifyTokenConfigurado: Boolean(process.env.WHATSAPP_VERIFY_TOKEN),
  });
};

const billing = async (req, res) => {
  const faturas = await Invoice.find({ tenantId: req.tenant._id }).sort({ competencia: -1 }).limit(24).lean();
  res.json({
    plano: req.tenant.plano,
    status: req.tenant.status,
    trialEndsAt: req.tenant.trialEndsAt,
    billing: pick(req.tenant.billing || {}, ['ciclo', 'diaVencimento', 'isento']),
    planos: Object.values(PLANS),
    faturas,
  });
};

// Troca de plano self-service (vale a partir da próxima fatura).
const changePlan = async (req, res) => {
  const { plano, ciclo } = req.body || {};
  if (!PLANS[plano] || PLANS[plano].sobConsulta) return res.status(400).json({ message: 'Plano inválido' });
  if (ciclo && !['mensal', 'anual'].includes(ciclo)) return res.status(400).json({ message: 'Ciclo inválido' });
  const maxPessoas = getPlan(plano).limites.pessoas;
  if (maxPessoas && await Person.countDocuments({ status: 'ativo' }) > maxPessoas) {
    return res.status(400).json({ message: `O plano ${PLANS[plano].nome} comporta até ${maxPessoas} pessoas ativas.` });
  }
  await Tenant.updateOne({ _id: req.tenant._id }, { $set: { plano, ...(ciclo ? { 'billing.ciclo': ciclo } : {}) } });
  invalidateTenant(req.tenant._id);
  if (process.env.ALERT_EMAIL) {
    sendEmail({ to: process.env.ALERT_EMAIL, subject: `Troca de plano: ${req.tenant.nome} → ${plano}`, text: `${req.user.nome} alterou o plano para ${plano} (${ciclo || 'ciclo mantido'}).` })
      .catch(() => {});
  }
  const updated = await getTenantById(req.tenant._id);
  return runWithTenant(updated, () => res.json(serializeForTenantAdmin(updated)));
};

module.exports = { get, updateSettings, whatsappStatus, whatsappTest, webhookInfo, billing, changePlan, listGroups, createGroup, apresentar };
