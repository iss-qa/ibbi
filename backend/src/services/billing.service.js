const axios = require('axios');
const Tenant = require('../models/Tenant.model');
const Invoice = require('../models/Invoice.model');
const { invoiceAmountFor, getPlan } = require('../config/plans');
const { sendEmail } = require('./email.service');
const { invalidateTenant } = require('../tenancy/tenant.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = () => Number(process.env.BILLING_GRACE_DAYS) || 3;
const SUSPEND_AFTER_DAYS = () => Number(process.env.BILLING_SUSPEND_AFTER_DAYS) || 15;

const competenciaOf = (date = new Date()) => date.toISOString().slice(0, 7);
const toIso = (d) => new Date(d).toISOString().slice(0, 10);

// ── Asaas (opcional) ────────────────────────────────────────────────────
const asaasEnabled = () => Boolean(process.env.ASAAS_API_KEY);
const asaas = () => axios.create({
  baseURL: process.env.ASAAS_API_URL || 'https://api.asaas.com/v3',
  headers: { access_token: process.env.ASAAS_API_KEY, 'Content-Type': 'application/json' },
  timeout: 20000,
});

const ensureAsaasCustomer = async (tenant) => {
  if (tenant.billing?.asaasCustomerId) return tenant.billing.asaasCustomerId;
  const { data } = await asaas().post('/customers', {
    name: tenant.nome,
    cpfCnpj: tenant.documento ? String(tenant.documento).replace(/\D/g, '') : undefined,
    email: tenant.email,
    mobilePhone: tenant.telefone ? String(tenant.telefone).replace(/\D/g, '') : undefined,
    externalReference: String(tenant._id),
  });
  await Tenant.updateOne({ _id: tenant._id }, { $set: { 'billing.asaasCustomerId': data.id } });
  invalidateTenant(tenant._id);
  return data.id;
};

const createGatewayCharge = async (invoice, tenant) => {
  if (!asaasEnabled() || invoice.valor <= 0 || invoice.gateway?.id) return invoice;
  try {
    const customer = await ensureAsaasCustomer(tenant);
    const { data } = await asaas().post('/payments', {
      customer,
      billingType: 'UNDEFINED', // cliente escolhe PIX, boleto ou cartão
      value: invoice.valor,
      dueDate: toIso(invoice.vencimento),
      description: invoice.descricao,
      externalReference: String(invoice._id),
    });
    invoice.gateway = { provider: 'asaas', id: data.id, invoiceUrl: data.invoiceUrl, status: data.status };
    await invoice.save();
  } catch (err) {
    console.error('[BILLING] Falha ao criar cobrança Asaas:', err?.response?.data || err.message);
  }
  return invoice;
};

// ── Faturas ─────────────────────────────────────────────────────────────
const dueDateFor = (tenant, competencia) => {
  const [y, m] = competencia.split('-').map(Number);
  const dia = tenant.billing?.diaVencimento || 10;
  const due = new Date(Date.UTC(y, m - 1, dia, 12));
  const minDue = new Date(Date.now() + 5 * DAY_MS);
  return due < minDue ? minDue : due;
};

const generateInvoice = async (tenant, competencia = competenciaOf()) => {
  const existing = await Invoice.findOne({ tenantId: tenant._id, competencia });
  if (existing) return { invoice: existing, criada: false };
  const valor = invoiceAmountFor(tenant);
  if (valor <= 0) return { invoice: null, criada: false };
  const plan = getPlan(tenant.plano);
  const ciclo = tenant.billing?.ciclo || 'mensal';
  const invoice = await Invoice.create({
    tenantId: tenant._id,
    competencia,
    plano: tenant.plano,
    ciclo,
    valor,
    descricao: `Assinatura ${plan.nome} (${ciclo}) — ${competencia}`,
    vencimento: dueDateFor(tenant, competencia),
  });
  await createGatewayCharge(invoice, tenant);
  return { invoice, criada: true };
};

const reactivateIfBlocked = async (tenantId) => {
  const pendentes = await Invoice.countDocuments({ tenantId, status: 'vencido' });
  if (pendentes) return;
  await Tenant.updateOne({ _id: tenantId, status: { $in: ['inadimplente', 'suspensa'] } }, { $set: { status: 'ativa' } });
  invalidateTenant(tenantId);
};

const markPaid = async (invoice, { valorPago, metodo = 'pix', pagoEm = new Date(), observacao } = {}) => {
  invoice.status = 'pago';
  invoice.pagoEm = pagoEm;
  invoice.valorPago = valorPago ?? invoice.valor;
  invoice.metodo = metodo;
  if (observacao) invoice.observacao = observacao;
  await invoice.save();
  await reactivateIfBlocked(invoice.tenantId);
  return invoice;
};

const annualAlreadyBilled = async (tenant) => {
  const since = competenciaOf(new Date(Date.now() - 335 * DAY_MS));
  return Invoice.exists({ tenantId: tenant._id, ciclo: 'anual', competencia: { $gte: since }, status: { $ne: 'cancelado' } });
};

const notifyOverdue = async (tenant, invoice) => {
  if (!tenant.email) return;
  await sendEmail({
    to: tenant.email,
    subject: `Fatura vencida — ${invoice.descricao}`,
    text: `Olá! A fatura "${invoice.descricao}" no valor de R$ ${invoice.valor.toFixed(2)} venceu em ${toIso(invoice.vencimento)}.`
      + `${invoice.gateway?.invoiceUrl ? `\nPague em: ${invoice.gateway.invoiceUrl}` : ''}`
      + `\nApós ${SUSPEND_AFTER_DAYS()} dias de atraso o acesso é suspenso automaticamente.`,
  }).catch((err) => console.error('[BILLING] Falha no email de cobrança:', err.message));
};

// Ciclo diário: fim de trial, geração de faturas, vencimentos, inadimplência e suspensão.
const runBillingCycle = async () => {
  const now = new Date();
  const resumo = { trialsEncerrados: 0, faturasGeradas: 0, vencidas: 0, inadimplentes: 0, suspensas: 0 };

  const trials = await Tenant.find({ status: 'trial', trialEndsAt: { $lte: now } });
  for (const t of trials) {
    t.status = 'ativa';
    await t.save();
    invalidateTenant(t._id);
    resumo.trialsEncerrados += 1;
  }

  const billables = await Tenant.find({ status: { $in: ['ativa', 'inadimplente', 'suspensa'] }, 'billing.isento': { $ne: true } }).lean();
  for (const tenant of billables) {
    if (tenant.billing?.ciclo === 'anual' && await annualAlreadyBilled(tenant)) continue;
    const { criada } = await generateInvoice(tenant);
    if (criada) resumo.faturasGeradas += 1;
  }

  const vencendo = await Invoice.find({ status: 'pendente', vencimento: { $lt: now } });
  for (const inv of vencendo) {
    inv.status = 'vencido';
    await inv.save();
    resumo.vencidas += 1;
    const tenant = await Tenant.findById(inv.tenantId).lean();
    if (tenant) await notifyOverdue(tenant, inv);
  }

  const vencidas = await Invoice.aggregate([
    { $match: { status: 'vencido' } },
    { $group: { _id: '$tenantId', maisAntiga: { $min: '$vencimento' } } },
  ]);
  for (const row of vencidas) {
    const dias = Math.floor((now - row.maisAntiga) / DAY_MS);
    let status = null;
    if (dias >= SUSPEND_AFTER_DAYS()) status = 'suspensa';
    else if (dias >= GRACE_DAYS()) status = 'inadimplente';
    if (!status) continue;
    const r = await Tenant.updateOne(
      { _id: row._id, status: { $in: status === 'suspensa' ? ['ativa', 'inadimplente'] : ['ativa'] } },
      { $set: { status } },
    );
    if (r.modifiedCount) {
      invalidateTenant(row._id);
      resumo[status === 'suspensa' ? 'suspensas' : 'inadimplentes'] += 1;
    }
  }

  return resumo;
};

// Webhook Asaas → baixa/vencimento da fatura.
const handleAsaasEvent = async ({ event, payment }) => {
  if (!payment) return null;
  const invoice = await Invoice.findOne({ $or: [{ 'gateway.id': payment.id }, ...(payment.externalReference?.match(/^[a-f0-9]{24}$/) ? [{ _id: payment.externalReference }] : [])] });
  if (!invoice) return null;
  invoice.gateway = { ...(invoice.gateway || {}), provider: 'asaas', id: payment.id, status: payment.status, invoiceUrl: payment.invoiceUrl || invoice.gateway?.invoiceUrl };
  if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event) && invoice.status !== 'pago') {
    const metodo = { PIX: 'pix', BOLETO: 'boleto', CREDIT_CARD: 'cartao' }[payment.billingType] || 'outro';
    return markPaid(invoice, { valorPago: payment.value, metodo, pagoEm: payment.paymentDate ? new Date(payment.paymentDate) : new Date() });
  }
  if (event === 'PAYMENT_OVERDUE' && invoice.status === 'pendente') invoice.status = 'vencido';
  if (['PAYMENT_DELETED', 'PAYMENT_REFUNDED'].includes(event)) invoice.status = 'cancelado';
  await invoice.save();
  return invoice;
};

module.exports = {
  competenciaOf,
  generateInvoice,
  createGatewayCharge,
  markPaid,
  runBillingCycle,
  handleAsaasEvent,
  asaasEnabled,
};
