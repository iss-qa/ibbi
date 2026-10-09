const Tenant = require('../models/Tenant.model');
const Invoice = require('../models/Invoice.model');
const { invalidateTenant } = require('../tenancy/tenant.service');
const { sendEmail } = require('./email.service');

/**
 * Programa de indicação entre igrejas:
 *  - código = slug da igreja; link: <APP_URL>/cadastro?ref=<codigo>
 *  - a indicada ganha +7 dias de teste;
 *  - a que indicou ganha 1 mês grátis quando a indicada paga a 1ª fatura (não por cadastro, evita fraude);
 *  - o crédito é consumido na próxima fatura (nasce paga, valor pago R$ 0, sem gateway).
 * Rotinas de plataforma: Tenant e Invoice são globais (sem tenantPlugin).
 */
const BONUS_TRIAL_DIAS = 7;
const appUrl = () => String(process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const linkDe = (tenant) => `${appUrl()}/cadastro?ref=${encodeURIComponent(tenant.slug)}`;

// Cadastro com ?ref=: valida a igreja que indicou (ativa, não a própria).
const resolverIndicador = async (ref, slugNovo) => {
  const codigo = String(ref || '').trim().toLowerCase();
  if (!codigo || codigo === String(slugNovo || '').toLowerCase()) return null;
  return Tenant.findOne({ slug: codigo, status: { $in: ['trial', 'ativa', 'inadimplente'] } }).select('_id nome slug').lean();
};

// 1ª fatura paga da igreja indicada → +1 mês de crédito para quem indicou (uma vez só).
const onInvoicePaid = async (invoice) => {
  if (!invoice || Number(invoice.valorPago ?? invoice.valor) <= 0) return null;
  const indicada = await Tenant.findOneAndUpdate(
    { _id: invoice.tenantId, 'indicacao.indicadoPor': { $ne: null }, 'indicacao.recompensaConcedida': { $ne: true } },
    { $set: { 'indicacao.recompensaConcedida': true } },
    { new: true },
  ).lean();
  if (!indicada) return null;
  const indicador = await Tenant.findOneAndUpdate(
    { _id: indicada.indicacao.indicadoPor },
    { $inc: { 'indicacao.creditosMeses': 1 }, $push: { 'indicacao.concedidos': { tenantId: indicada._id, nome: indicada.nome, em: new Date() } } },
    { new: true },
  ).lean();
  if (!indicador) return null;
  invalidateTenant(indicador._id);
  if (indicador.email) {
    sendEmail({
      to: indicador.email,
      subject: '🎁 Você ganhou 1 mês grátis no PastorIA',
      text: `A ${indicada.nome}, indicada pela ${indicador.nome}, assinou o PastorIA. Como agradecimento, a próxima mensalidade da sua igreja é por nossa conta. Obrigado por espalhar o cuidado! — Equipe PastorIA`,
    }).catch(() => {});
  }
  return indicador;
};

// Na geração da fatura: se houver crédito, consome 1 (atômico) e a fatura nasce paga.
const consumirCredito = async (tenantId) => {
  const t = await Tenant.findOneAndUpdate(
    { _id: tenantId, 'indicacao.creditosMeses': { $gt: 0 } },
    { $inc: { 'indicacao.creditosMeses': -1 } },
    { new: true },
  ).lean();
  if (t) invalidateTenant(tenantId);
  return Boolean(t);
};

const resumo = async (tenant) => ({
  codigo: tenant.slug,
  link: linkDe(tenant),
  creditosMeses: tenant.indicacao?.creditosMeses || 0,
  concedidos: tenant.indicacao?.concedidos || [],
  indicadas: await Tenant.countDocuments({ 'indicacao.indicadoPor': tenant._id }),
  bonusTrialDias: BONUS_TRIAL_DIAS,
});

const faturasCredito = (tenantId) => Invoice.countDocuments({ tenantId, metodo: 'credito' });

module.exports = { BONUS_TRIAL_DIAS, linkDe, resolverIndicador, onInvoicePaid, consumirCredito, resumo, faturasCredito };
