const Tenant = require('../models/Tenant.model');
const Invoice = require('../models/Invoice.model');
const Person = require('../models/Person.model');
const whatsapp = require('../services/whatsapp.service');
const usage = require('../services/usage.service');
const { sendEmail } = require('../services/email.service');
const { PLANS, hasFeature, getPlan } = require('../config/plans');
const { randomToken } = require('../utils/crypto');
const { applyWhatsappConfig, assertCloudNumberFree, apresentarSeConectado } = require('../services/whatsapp-config.service');
const { apresentarNumero } = require('../services/leadership.service');
const { invalidateTenant, getTenantById, serializeForTenantAdmin, serializeForMember } = require('../tenancy/tenant.service');
const { runWithTenant } = require('../tenancy/context');

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

const get = async (req, res) => {
  const [consumo, pessoasAtivas] = await Promise.all([
    usage.getUsage(req.tenant._id),
    Person.countDocuments({ status: 'ativo' }),
  ]);
  const base = req.user.role === 'master'
    ? serializeForTenantAdmin(req.tenant)
    : serializeForMember(req.tenant, req.user.role);
  res.json({ ...base, consumo, pessoasAtivas });
};

// Gera um token novo para o webhook da Evolution (o antigo deixa de valer na hora).
const rotateWebhookToken = async (req, res) => {
  const tenant = await Tenant.findById(req.tenant._id);
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada' });
  tenant.whatsapp.webhookToken = randomToken(20);
  await tenant.save();
  invalidateTenant(tenant._id);
  req.tenant = tenant;
  return webhookInfo(req, res);
};

// Atualização das configurações pela própria igreja (master).
const updateSettings = async (req, res) => {
  const body = req.body || {};
  const tenant = await Tenant.findById(req.tenant._id);
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada' });

  Object.assign(tenant, pick(body, ['nome', 'nomeCurto', 'email', 'telefone', 'responsavel', 'cidade', 'uf', 'timezone', 'programacaoSemanal']));
  if (Array.isArray(body.congregacoes)) {
    const lista = [...new Set(body.congregacoes.map((c) => String(c).trim()).filter(Boolean))];
    if (!lista.length) return res.status(400).json({ message: 'Informe ao menos uma congregação' });
    tenant.congregacoes = lista;
  }
  if (body.branding) tenant.branding = { ...tenant.branding?.toObject?.(), ...pick(body.branding, ['logoUrl', 'corPrimaria', 'corSecundaria', 'assinatura', 'portalUrl']) };
  if (body.automacoes) tenant.automacoes = body.automacoes;
  // Pix da igreja (eventos pagos): limites do padrão BR Code (nome ≤ 25, cidade ≤ 15)
  if (body.pix) {
    tenant.pix = {
      chave: String(body.pix.chave || '').trim().slice(0, 77) || undefined,
      nome: String(body.pix.nome || '').trim().slice(0, 25) || undefined,
      cidade: String(body.pix.cidade || '').trim().slice(0, 15) || undefined,
    };
  }
  // Agenda semanal de cultos (lembretes)
  if (Array.isArray(body.cultosProgramados)) {
    tenant.cultosProgramados = body.cultosProgramados.slice(0, 30)
      .filter((c) => c && /^[0-6]$/.test(String(c.diaSemana)) && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(c.horario || '')))
      .map((c) => ({
        ...(c._id ? { _id: c._id } : {}),
        titulo: String(c.titulo || 'Culto').trim().slice(0, 60), diaSemana: Number(c.diaSemana), horario: c.horario,
        congregacao: c.congregacao || undefined, liveUrl: /^https?:\/\//i.test(String(c.liveUrl || '')) ? String(c.liveUrl).slice(0, 300) : undefined,
        lembreteMin: Math.min(1440, Math.max(30, Number(c.lembreteMin) || 180)),
        grupoJid: /@g\.us$/.test(String(c.grupoJid || '')) ? c.grupoJid : undefined, ativo: c.ativo !== false,
      }));
  }
  if (body.ia) tenant.ia = { ...tenant.ia?.toObject?.(), ...pick(body.ia, ['ativo', 'nomeAssistente', 'tom', 'cadastroPublico', 'instrucoesExtras']) };
  if (Array.isArray(body.lideranca)) tenant.lideranca = body.lideranca;
  if (Array.isArray(body.ebdLideres)) tenant.ebdLideres = body.ebdLideres;

  let whatsappMudou = false;
  if (body.whatsapp) {
    const w = body.whatsapp;
    try {
      await assertCloudNumberFree(tenant, w);
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
  if (whatsapp.desativado(req.tenant)) return res.json({ online: false, configurado: true, desativado: true });
  if (!whatsapp.isConfigured(req.tenant)) return res.json({ online: false, configurado: false });
  const state = await whatsapp.connectionState(req.tenant).catch((err) => ({ online: false, error: err.message }));
  return res.json({ configurado: true, ...whatsapp.getProvider(req.tenant).describe(), ...state, antiban: whatsapp.antibanStats() });
};

// Liga/desliga o WhatsApp da igreja na hora (sem "Salvar"). Desligar cancela a fila pendente;
// ligar não reapresenta o número à liderança.
const setWhatsappAtivo = async (req, res) => {
  if (typeof req.body?.ativo !== 'boolean') return res.status(400).json({ message: 'Informe ativo: true ou false' });
  const { ativo } = req.body;
  await Tenant.updateOne({ _id: req.tenant._id }, { $set: { 'whatsapp.ativo': ativo, 'whatsapp.desativadoEm': ativo ? null : new Date() } });
  invalidateTenant(req.tenant._id);
  whatsapp.marcarAtivo(req.tenant._id, ativo);
  const pendentes = ativo ? 0 : whatsapp.getQueueStatus().pendente;
  if (!ativo) whatsapp.cancelQueue();
  console.log(`[WHATSAPP] ${req.tenant.slug}: ${ativo ? 'ligado' : `desligado (${pendentes} na fila cancelado(s))`} por ${req.user?.login || req.user?._id}`);
  return res.json({ ativo, filaCancelada: pendentes });
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
  // Valor negociado vale para o plano em que foi negociado: trocou de plano, volta ao preço de tabela
  const trocouPlano = plano !== req.tenant.plano;
  await Tenant.updateOne({ _id: req.tenant._id }, {
    $set: { plano, ...(ciclo ? { 'billing.ciclo': ciclo } : {}) },
    ...(trocouPlano ? { $unset: { 'billing.valorMensal': 1 } } : {}),
  });
  invalidateTenant(req.tenant._id);
  if (process.env.ALERT_EMAIL) {
    sendEmail({ to: process.env.ALERT_EMAIL, subject: `Troca de plano: ${req.tenant.nome} → ${plano}`, text: `${req.user.nome} alterou o plano para ${plano} (${ciclo || 'ciclo mantido'}).` })
      .catch(() => {});
  }
  const updated = await getTenantById(req.tenant._id);
  return runWithTenant(updated, () => res.json(serializeForTenantAdmin(updated)));
};

// ── Primeiros passos (onboarding) e aceite dos termos ──────────────────
const onboardingSvc = require('../services/onboarding.service');
const onboarding = async (req, res) => res.json(await onboardingSvc.status(req.tenant._id));
const onboardingConfirmar = async (req, res) => {
  await onboardingSvc.confirmar(req.tenant._id, String(req.body?.etapa || ''));
  return res.json(await onboardingSvc.status(req.tenant._id));
};
const onboardingDispensar = async (req, res) => {
  await onboardingSvc.dispensar(req.tenant._id, req.body?.dispensar !== false);
  return res.json(await onboardingSvc.status(req.tenant._id));
};
const indicacao = async (req, res) => res.json(await require('../services/indicacao.service').resumo(await Tenant.findById(req.tenant._id).lean()));

const aceitarTermos = async (req, res) => {
  if (req.body?.aceito !== true) return res.status(400).json({ message: 'É preciso marcar o aceite' });
  await onboardingSvc.aceitarTermos(req.tenant._id, { nome: req.user.nome, ip: req.ip });
  return res.json(await onboardingSvc.status(req.tenant._id));
};

module.exports = {
  onboarding,
  onboardingConfirmar,
  onboardingDispensar,
  aceitarTermos,
  indicacao, rotateWebhookToken, get, updateSettings, whatsappStatus, setWhatsappAtivo, whatsappTest, webhookInfo, billing, changePlan, listGroups, createGroup, apresentar };
