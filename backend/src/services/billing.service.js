const crypto = require('crypto');
const Tenant = require('../models/Tenant.model');
const Invoice = require('../models/Invoice.model');
const { invoiceAmountFor, getPlan } = require('../config/plans');
const { sendEmail } = require('./email.service');
const woovi = require('./woovi.service');
const { invalidateTenant } = require('../tenancy/tenant.service');

const DAY_MS = 24 * 60 * 60 * 1000;
// Atraso (dias após o vencimento): a partir de GRACE a igreja fica "inadimplente" (só aviso);
// a partir de SUSPEND o acesso é suspenso, exceto a tela de Assinatura.
const GRACE_DAYS = () => Number(process.env.BILLING_GRACE_DAYS) || 1;
const SUSPEND_AFTER_DAYS = () => Number(process.env.BILLING_SUSPEND_AFTER_DAYS) || 7;
// Validade do Pix: vencimento + este prazo. Expirou sem pagamento → um novo Pix é gerado ao pagar.
const CHARGE_TTL_DAYS = () => Number(process.env.WOOVI_CHARGE_TTL_DAYS) || 30;

const OPEN = ['pendente', 'vencido'];
const competenciaOf = (date = new Date()) => date.toISOString().slice(0, 7);
const toIso = (d) => new Date(d).toISOString().slice(0, 10);
const cents = (v) => Math.round(Number(v || 0) * 100);
const brl = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const appUrl = () => (process.env.APP_URL || 'https://pastoria.issqa.com.br').replace(/\/$/, '');
const diasDeAtraso = (vencimento, now = new Date()) => Math.max(0, Math.floor((now - new Date(vencimento)) / DAY_MS));

// pastoria-<id da fatura>-<tentativa>-<aleatório>
const invoiceIdFrom = (correlationID) => /^pastoria-([a-f0-9]{24})-/.exec(correlationID || '')?.[1] || null;

// Status da igreja pelo atraso da fatura vencida mais antiga. Só mexe em quem está
// ativa/inadimplente/suspensa (trial e cancelada seguem outras regras).
const recomputeStatus = async (tenantId, now = new Date()) => {
  const tenant = await Tenant.findById(tenantId).select('status billing').lean();
  if (!tenant || !['ativa', 'inadimplente', 'suspensa'].includes(tenant.status)) return tenant?.status;
  let status = 'ativa';
  if (!tenant.billing?.isento) {
    const maisAntiga = await Invoice.findOne({ tenantId, status: 'vencido' }).sort({ vencimento: 1 }).select('vencimento').lean();
    const dias = maisAntiga ? diasDeAtraso(maisAntiga.vencimento, now) : 0;
    if (maisAntiga && dias >= SUSPEND_AFTER_DAYS()) status = 'suspensa';
    else if (maisAntiga && dias >= GRACE_DAYS()) status = 'inadimplente';
  }
  if (status !== tenant.status) {
    await Tenant.updateOne({ _id: tenantId, status: tenant.status }, { $set: { status } });
    invalidateTenant(tenantId);
  }
  return status;
};

// ── Baixa ───────────────────────────────────────────────────────────────
// Atômica: webhooks repetidos (CHARGE_COMPLETED + TRANSACTION_RECEIVED) dão baixa uma vez só.
const markPaid = async (invoice, { valorPago, metodo = 'pix', pagoEm = new Date(), observacao, gatewayStatus } = {}) => {
  const updated = await Invoice.findOneAndUpdate(
    { _id: invoice._id, status: { $ne: 'pago' } },
    { $set: {
      status: 'pago',
      pagoEm,
      valorPago: valorPago ?? invoice.valor,
      metodo,
      ...(observacao ? { observacao } : {}),
      ...(gatewayStatus ? { 'gateway.status': gatewayStatus } : {}),
    } },
    { new: true },
  );
  if (!updated) return Invoice.findById(invoice._id);
  // Baixa manual no painel: tira o Pix do ar para a igreja não pagar duas vezes.
  if (!gatewayStatus && updated.gateway?.provider === 'woovi' && updated.gateway.status === 'ACTIVE') {
    if (await woovi.deleteCharge(updated.gateway.id)) await Invoice.updateOne({ _id: updated._id }, { $set: { 'gateway.status': 'REMOVED' } });
  }
  await recomputeStatus(updated.tenantId);
  // Indicação: 1ª fatura paga da igreja indicada → 1 mês grátis para quem indicou.
  await require('./indicacao.service').onInvoicePaid(updated).catch((err) => console.error('[INDICAÇÃO]', err.message));
  return updated;
};

const confirmPaid = (invoice, charge) => {
  const valorPago = Number(charge.value || 0) / 100;
  const pagoEm = charge.paidAt ? new Date(charge.paidAt) : new Date();
  // Pix de uma cobrança anterior a um reajuste de plano: baixa, mas registra a diferença
  const observacao = cents(valorPago) < cents(invoice.valor)
    ? `Pix de ${brl(valorPago)} (cobrança anterior ao reajuste de ${brl(invoice.valor)})`
    : undefined;
  return markPaid(invoice, { valorPago, metodo: 'pix', pagoEm, observacao, gatewayStatus: 'COMPLETED' });
};

// ── Cobrança Pix (Woovi) ────────────────────────────────────────────────
const chargeIsUsable = (invoice) => {
  const g = invoice.gateway || {};
  return g.provider === 'woovi' && g.id && g.brCode && g.status === 'ACTIVE'
    && cents(g.valor) === cents(invoice.valor)
    && (!g.expiraEm || new Date(g.expiraEm) > new Date(Date.now() + 60 * 60 * 1000));
};

// Confere a cobrança direto na Woovi (o webhook só avisa; a baixa vem daqui).
const syncCharge = async (invoice, correlationID = invoice.gateway?.id) => {
  if (!correlationID || !woovi.enabled() || invoice.status === 'pago') return invoice;
  const charge = await woovi.getCharge(correlationID);
  if (!charge) return invoice;
  if (charge.status === 'COMPLETED') {
    if (invoice.status === 'cancelado') {
      console.warn(`[BILLING] Pix pago em fatura cancelada ${invoice._id} (${correlationID}) — conferir no painel.`);
      return invoice;
    }
    return confirmPaid(invoice, charge);
  }
  const set = { 'gateway.verificadoEm': new Date() };
  if (correlationID === invoice.gateway?.id && charge.status) set['gateway.status'] = charge.status;
  return Invoice.findOneAndUpdate({ _id: invoice._id }, { $set: set }, { new: true });
};

// Garante um Pix válido para a fatura em aberto: reaproveita o atual ou gera outro quando
// não existe, expirou ou o valor mudou (troca de plano). Antes de trocar, confere se o
// anterior já foi pago.
const createGatewayCharge = async (invoice, tenant, { throwOnError = false } = {}) => {
  if (!woovi.enabled() || invoice.valor <= 0 || !OPEN.includes(invoice.status)) return invoice;
  if (chargeIsUsable(invoice)) return invoice;
  try {
    const anterior = invoice.gateway?.provider === 'woovi' && invoice.gateway.id ? invoice.gateway.id : null;
    if (anterior && invoice.gateway.status === 'ACTIVE') {
      const atual = await woovi.getCharge(anterior);
      if (atual?.status === 'COMPLETED') return confirmPaid(invoice, atual);
      if (atual?.status === 'ACTIVE') await woovi.deleteCharge(anterior);
    }
    const tentativas = (invoice.gateway?.tentativas || 0) + 1;
    const correlationID = `${woovi.CORRELATION_PREFIX}${invoice._id}-${tentativas}-${Math.random().toString(36).slice(2, 6)}`;
    const base = Math.max(new Date(invoice.vencimento).getTime(), Date.now());
    const expira = new Date(base + CHARGE_TTL_DAYS() * DAY_MS);
    const dados = {
      correlationID,
      valueCents: cents(invoice.valor),
      comment: `PastorIA - ${invoice.descricao}`,
      customer: woovi.customerFor(tenant),
      expiresDate: expira,
      additionalInfo: [
        { key: 'Igreja', value: String(tenant.nome || tenant.slug).slice(0, 60) },
        { key: 'Fatura', value: invoice.competencia },
      ],
    };
    // Boleto + Pix quando habilitado e a igreja tem CNPJ e endereço; se a Woovi recusar, só Pix.
    const pagadorBoleto = woovi.boletoEnabled() ? woovi.boletoCustomerFor(tenant) : null;
    let charge;
    if (pagadorBoleto) {
      try {
        charge = await woovi.createCharge({ ...dados, type: 'BOLETO', customer: pagadorBoleto });
      } catch (err) {
        console.warn(`[BILLING] Boleto recusado pela Woovi (fatura ${invoice._id}), seguindo só com Pix:`, err.message);
      }
    }
    if (!charge) charge = await woovi.createCharge(dados);
    const bol = charge?.paymentMethods?.boleto;
    invoice.gateway = {
      provider: 'woovi',
      id: correlationID,
      chargeId: charge?.globalID || charge?.identifier,
      invoiceUrl: charge?.paymentLinkUrl,
      brCode: charge?.brCode || charge?.paymentMethods?.pix?.brCode,
      boleto: bol?.boletoDigitable ? { digitable: bol.boletoDigitable, barcode: bol.boletoBarcode, imagem: bol.barcodeImage } : undefined,
      valor: invoice.valor,
      expiraEm: charge?.expiresDate ? new Date(charge.expiresDate) : expira,
      status: charge?.status || 'ACTIVE',
      tentativas,
      verificadoEm: new Date(),
    };
    await invoice.save();
  } catch (err) {
    console.error(`[BILLING] Falha ao criar Pix na Woovi (fatura ${invoice._id}):`, err.message);
    if (throwOnError) throw err;
  }
  return invoice;
};

// Webhook Woovi → confere a cobrança na API e dá baixa / marca expirada.
// Conta compartilhada: eventos de cobranças que não são do PastorIA são ignorados.
const handleWooviEvent = async (body) => {
  const correlationID = woovi.correlationIdOf(body);
  const invoiceId = invoiceIdFrom(correlationID);
  if (!invoiceId) return { ignorado: true };
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return { ignorado: true };
  const atualizado = await syncCharge(invoice, correlationID);
  return { ignorado: false, status: atualizado?.status };
};

// ── Faturas ─────────────────────────────────────────────────────────────
const dueDateFor = (tenant, competencia) => {
  const [y, m] = competencia.split('-').map(Number);
  const dia = tenant.billing?.diaVencimento || 10;
  const due = new Date(Date.UTC(y, m - 1, dia, 12));
  const minDue = new Date(Date.now() + 5 * DAY_MS);
  return due < minDue ? minDue : due;
};

const descricaoDe = (tenant, competencia) => {
  const ciclo = tenant.billing?.ciclo || 'mensal';
  return `Assinatura ${getPlan(tenant.plano).nome} (${ciclo}) — ${competencia}`;
};

// ── Email da fatura e link público de pagamento ─────────────────────────
const newPublicToken = () => crypto.randomBytes(18).toString('base64url');
const ensurePublicToken = async (invoice) => {
  if (invoice.publicToken) return invoice.publicToken;
  const token = newPublicToken();
  await Invoice.updateOne({ _id: invoice._id, publicToken: { $exists: false } }, { $set: { publicToken: token } });
  invoice.publicToken = (await Invoice.findById(invoice._id).select('publicToken').lean())?.publicToken || token;
  return invoice.publicToken;
};
const payUrlFor = (token) => `${appUrl()}/pagar/${token}`;
const emailCobrancaDe = (tenant) => tenant.emailCobranca || tenant.email;

// tipo: nova | reajustada | vencida | lembrete. Pix (QR inline + copia e cola) e boleto, se houver.
const sendInvoiceEmail = async (tenant, invoice, tipo = 'nova') => {
  const to = emailCobrancaDe(tenant);
  if (!to || invoice.valor <= 0) return false;
  const tpl = require('../templates/invoice-email.template');
  const token = await ensurePublicToken(invoice);
  const brCode = invoice.gateway?.status === 'ACTIVE' ? invoice.gateway.brCode : null;
  const qr = brCode ? await require('qrcode').toBuffer(brCode, { margin: 1, width: 440 }).catch(() => null) : null;
  const ctx = {
    tipo,
    igreja: tenant.nome,
    fatura: invoice,
    pagarUrl: payUrlFor(token),
    brCode,
    temQr: Boolean(qr),
    boleto: invoice.gateway?.status === 'ACTIVE' ? invoice.gateway.boleto : null,
    suspendeAposDias: SUSPEND_AFTER_DAYS(),
    logoUrl: /^https:/.test(appUrl()) ? `${appUrl()}/brand/pastoria-logo-horizontal.png` : null,
  };
  try {
    await sendEmail({
      to,
      subject: tpl.invoiceEmailSubject(ctx),
      html: tpl.invoiceEmailHtml(ctx),
      text: tpl.invoiceEmailText(ctx),
      attachments: qr ? [{ filename: 'pix.png', content: qr, cid: 'pix-qr', contentType: 'image/png' }] : undefined,
    });
    await Invoice.updateOne({ _id: invoice._id }, { $set: { emailEnviadoEm: new Date() }, $inc: { lembretesEnviados: tipo === 'nova' ? 0 : 1 } });
    return true;
  } catch (err) {
    console.error(`[BILLING] Falha no email da fatura ${invoice._id} (${tipo}):`, err.message);
    return false;
  }
};

// Página pública /pagar/:token — só o necessário para pagar (sem dados internos).
const findByPublicToken = (token) => (/^[A-Za-z0-9_-]{20,40}$/.test(String(token || ''))
  ? Invoice.findOne({ publicToken: token })
  : null);

const publicView = async (invoice, { gerarPix = false } = {}) => {
  const tenant = await Tenant.findById(invoice.tenantId).lean();
  let atual = invoice;
  if (gerarPix && OPEN.includes(atual.status) && tenant && woovi.enabled()) {
    atual = await createGatewayCharge(atual, tenant);
  }
  const g = atual.gateway || {};
  const ativo = OPEN.includes(atual.status) && g.status === 'ACTIVE';
  return {
    igreja: tenant?.nome,
    descricao: atual.descricao,
    valor: atual.valor,
    vencimento: atual.vencimento,
    status: atual.status,
    pagoEm: atual.pagoEm,
    diasAtraso: atual.status === 'vencido' ? diasDeAtraso(atual.vencimento) : 0,
    pix: ativo && g.brCode ? {
      brCode: g.brCode,
      qrCode: await require('qrcode').toDataURL(g.brCode, { margin: 1, width: 320 }),
      expiraEm: g.expiraEm,
    } : null,
    boleto: ativo && g.boleto?.digitable ? g.boleto : null,
    gatewayAtivo: woovi.enabled(),
  };
};

const generateInvoice = async (tenant, competencia = competenciaOf()) => {
  const existing = await Invoice.findOne({ tenantId: tenant._id, competencia });
  if (existing) return { invoice: existing, criada: false };
  const valor = invoiceAmountFor(tenant);
  if (valor <= 0) return { invoice: null, criada: false };
  const ciclo = tenant.billing?.ciclo || 'mensal';
  // Indicação: crédito de 1 mês → a fatura nasce paga (valor pago R$ 0), sem cobrança no gateway.
  // Só faturas mensais consomem crédito (no anual, o desconto já é de 2 meses).
  const credito = ciclo === 'mensal' && await require('./indicacao.service').consumirCredito(tenant._id);
  let invoice;
  try {
    invoice = await Invoice.create({
      tenantId: tenant._id,
      competencia,
      plano: tenant.plano,
      ciclo,
      valor,
      descricao: descricaoDe(tenant, competencia),
      vencimento: dueDateFor(tenant, competencia),
      publicToken: newPublicToken(),
      ...(credito ? { status: 'pago', pagoEm: new Date(), valorPago: 0, metodo: 'credito', observacao: '1 mês grátis por indicação' } : {}),
    });
  } catch (err) {
    // Crédito de indicação debitado e a fatura não foi criada aqui: devolve o mês.
    if (credito) await Tenant.updateOne({ _id: tenant._id }, { $inc: { 'indicacao.creditosMeses': 1 } }).catch(() => {});
    // Cron e "rodar cobrança" manual ao mesmo tempo: a outra execução já criou a fatura
    if (err.code === 11000) return { invoice: await Invoice.findOne({ tenantId: tenant._id, competencia }), criada: false };
    throw err;
  }
  if (!credito) {
    invoice = await createGatewayCharge(invoice, tenant);
    await sendInvoiceEmail(tenant, invoice, 'nova');
  }
  return { invoice, criada: true };
};

// Troca de plano/ciclo: a fatura em aberto do mês passa a ter o novo valor (e um novo Pix).
// Faturas de meses anteriores ficam como estão (refletem o plano usado naquele mês).
const repriceOpenInvoices = async (tenant) => {
  const valor = invoiceAmountFor(tenant);
  if (valor <= 0) return [];
  const ciclo = tenant.billing?.ciclo || 'mensal';
  const abertas = await Invoice.find({ tenantId: tenant._id, status: { $in: OPEN }, competencia: competenciaOf() });
  const reajustadas = [];
  for (const inv of abertas) {
    if (cents(inv.valor) === cents(valor) && inv.plano === tenant.plano && inv.ciclo === ciclo) continue;
    const valorAnterior = inv.valor;
    inv.valor = valor;
    inv.plano = tenant.plano;
    inv.ciclo = ciclo;
    inv.descricao = descricaoDe(tenant, inv.competencia);
    inv.observacao = `Reajustada de ${brl(valorAnterior)} para ${brl(valor)} pela troca de plano`;
    await inv.save();
    const nova = await createGatewayCharge(inv, tenant);
    if (OPEN.includes(nova.status)) await sendInvoiceEmail(tenant, nova, 'reajustada');
    reajustadas.push(nova);
  }
  return reajustadas;
};

const cancelInvoice = async (invoice, observacao) => {
  if (invoice.gateway?.provider === 'woovi' && invoice.gateway.status === 'ACTIVE') {
    const atual = await woovi.getCharge(invoice.gateway.id).catch(() => null);
    if (atual?.status === 'COMPLETED') return confirmPaid(invoice, atual); // pagou antes do cancelamento
    if (await woovi.deleteCharge(invoice.gateway.id)) invoice.gateway.status = 'REMOVED';
  }
  invoice.status = 'cancelado';
  if (observacao) invoice.observacao = observacao;
  await invoice.save();
  await recomputeStatus(invoice.tenantId);
  return invoice;
};

const annualAlreadyBilled = async (tenant) => {
  const since = competenciaOf(new Date(Date.now() - 335 * DAY_MS));
  return Invoice.exists({ tenantId: tenant._id, ciclo: 'anual', competencia: { $gte: since }, status: { $ne: 'cancelado' } });
};

// Ciclo diário: fim de trial, geração de faturas, conferência dos Pix, vencimentos,
// inadimplência e suspensão.
const runBillingCycle = async () => {
  const now = new Date();
  const resumo = { trialsEncerrados: 0, faturasGeradas: 0, pixConferidos: 0, pagasNaConferencia: 0, vencidas: 0, inadimplentes: 0, suspensas: 0 };

  const trials = await Tenant.find({ status: 'trial', trialEndsAt: { $lte: now } });
  for (const t of trials) {
    t.status = 'ativa';
    await t.save();
    invalidateTenant(t._id);
    resumo.trialsEncerrados += 1;
  }

  const billables = await Tenant.find({ status: { $in: ['ativa', 'inadimplente', 'suspensa'] }, 'billing.isento': { $ne: true } }).lean();
  // Uma igreja com erro (gateway fora, dado inválido) não interrompe o ciclo das demais
  for (const tenant of billables) {
    try {
      if (tenant.billing?.ciclo === 'anual' && await annualAlreadyBilled(tenant)) continue;
      const { criada } = await generateInvoice(tenant);
      if (criada) resumo.faturasGeradas += 1;
    } catch (err) {
      console.error(`[BILLING] Falha ao faturar ${tenant.slug || tenant._id}:`, err.message);
    }
  }

  // Webhook perdido (servidor fora, Woovi sem conseguir entregar): confere direto na API
  // e recria Pix que falharam na geração.
  if (woovi.enabled()) {
    const abertas = await Invoice.find({ status: { $in: OPEN }, valor: { $gt: 0 } });
    const tenants = new Map(billables.map((t) => [String(t._id), t]));
    for (const inv of abertas) {
      try {
        if (inv.gateway?.provider === 'woovi' && inv.gateway.id) {
          const atual = await syncCharge(inv);
          resumo.pixConferidos += 1;
          if (atual?.status === 'pago') resumo.pagasNaConferencia += 1;
        } else if (tenants.has(String(inv.tenantId))) {
          await createGatewayCharge(inv, tenants.get(String(inv.tenantId)));
        }
      } catch (err) {
        console.error(`[BILLING] Falha ao conferir Pix da fatura ${inv._id}:`, err.message);
      }
    }
  }

  const vencendo = await Invoice.find({ status: 'pendente', vencimento: { $lt: now } });
  for (const inv of vencendo) {
    try {
      inv.status = 'vencido';
      await inv.save();
      resumo.vencidas += 1;
      const tenant = await Tenant.findById(inv.tenantId).lean();
      if (tenant && !tenant.billing?.isento) await sendInvoiceEmail(tenant, inv, 'vencida');
    } catch (err) {
      console.error(`[BILLING] Falha ao marcar fatura ${inv._id} como vencida:`, err.message);
    }
  }

  // Igreja isenta (ex.: tenant fundador) nunca fica inadimplente/suspensa: recomputeStatus cuida disso.
  const comVencidas = await Invoice.distinct('tenantId', { status: 'vencido' });
  for (const tenantId of comVencidas) {
    const antes = (await Tenant.findById(tenantId).select('status').lean())?.status;
    const depois = await recomputeStatus(tenantId, now);
    if (depois !== antes && depois === 'suspensa') resumo.suspensas += 1;
    if (depois !== antes && depois === 'inadimplente') resumo.inadimplentes += 1;
  }

  return resumo;
};

// Resumo da fatura em aberto mais antiga, para o aviso no painel da igreja.
const openInvoiceSummary = async (tenantId) => {
  const inv = await Invoice.findOne({ tenantId, status: { $in: OPEN } }).sort({ vencimento: 1 }).lean();
  if (!inv) return null;
  const atraso = inv.status === 'vencido' || new Date(inv.vencimento) < new Date() ? diasDeAtraso(inv.vencimento) : 0;
  const abertas = await Invoice.countDocuments({ tenantId, status: { $in: OPEN } });
  return {
    _id: inv._id,
    descricao: inv.descricao,
    valor: inv.valor,
    vencimento: inv.vencimento,
    status: inv.status,
    diasAtraso: atraso,
    suspendeEm: new Date(new Date(inv.vencimento).getTime() + SUSPEND_AFTER_DAYS() * DAY_MS),
    abertas,
  };
};

const policy = () => ({ graceDays: GRACE_DAYS(), suspendAfterDays: SUSPEND_AFTER_DAYS(), gateway: woovi.enabled() ? 'woovi' : null });

module.exports = {
  competenciaOf,
  generateInvoice,
  createGatewayCharge,
  syncCharge,
  markPaid,
  cancelInvoice,
  repriceOpenInvoices,
  recomputeStatus,
  runBillingCycle,
  handleWooviEvent,
  openInvoiceSummary,
  invoiceIdFrom,
  policy,
  sendInvoiceEmail,
  ensurePublicToken,
  payUrlFor,
  findByPublicToken,
  publicView,
  gatewayEnabled: woovi.enabled,
};
