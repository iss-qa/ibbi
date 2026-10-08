const PedidoOracao = require('../models/PedidoOracao.model');
const Message = require('../models/Message.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');
const { getTenant } = require('../tenancy/context');
const { churchShort } = require('../tenancy/brand');

// Número que recebe os pedidos: configurado na igreja; o .env vale só para o tenant fundador.
const churchNumber = (tenant = getTenant()) => tenant?.whatsapp?.numeroIgreja
  || (tenant?.whatsapp?.useEnvFallback ? process.env.CHURCH_WHATSAPP_NUMBER : null);

const UMA_HORA = 60 * 60 * 1000;

// Um pedido por pessoa a cada hora (portal e WhatsApp).
const pedidoRecente = ({ userId, personId, nome }) => {
  const quem = userId ? { userId } : personId ? { personId } : { nome };
  return PedidoOracao.exists({ ...quem, createdAt: { $gte: new Date(Date.now() - UMA_HORA) } });
};

/**
 * Registra o pedido (lista da liderança) e, se a igreja configurou um número, repassa no WhatsApp.
 * O pedido fica salvo mesmo sem número configurado ou se o envio falhar.
 */
const registrarPedido = async ({ nome, personId, userId, celular, congregacao, texto, origem = 'web', enviadoPor }) => {
  const pedido = await PedidoOracao.create({ nome, personId, userId, celular, congregacao, texto, origem });
  const numero = churchNumber();
  if (!numero) return { pedido, encaminhado: false };
  const conteudo = templates.pedidoOracao(nome, texto, congregacao || '');
  let status = 'concluido';
  let erros = [];
  try {
    await whatsapp.sendSingle(numero, conteudo);
  } catch (err) {
    status = 'erro';
    erros = [{ celular: numero, motivo: err.message }];
  }
  const log = await Message.create({
    tipo: 'oracao', destinatarios: [{ nome: churchShort(), celular: numero }], conteudo, status, erros,
    enviadoPor, origemNome: nome, origemCongregacao: congregacao, concluidoEm: new Date(),
  });
  await PedidoOracao.updateOne({ _id: pedido._id }, { $set: { messageId: log._id } });
  return { pedido, encaminhado: status === 'concluido' };
};

const listarPedidos = ({ filtroCongregacao = {}, dias = 30, status, limite = 200 } = {}) => {
  const filter = { ...filtroCongregacao, createdAt: { $gte: new Date(Date.now() - dias * 864e5) } };
  if (status) filter.status = status;
  return PedidoOracao.find(filter).sort({ createdAt: -1 }).limit(limite).lean();
};

const marcarStatus = (id, status, por) => PedidoOracao.findOneAndUpdate(
  { _id: id },
  { $set: { status, ...(status === 'orado' ? { oradoEm: new Date(), oradoPor: por } : {}) } },
  { new: true },
).lean();

// Migração: pedidos antigos existiam só como log de mensagem (tipo 'oracao'). Idempotente por messageId.
const PEDIDO_RE = /De: \*([^*]+?)\*\s*\n\n([\s\S]*?)\n\n_Recebido/;
const importarPedidosAntigos = async () => {
  const jaImportados = new Set((await PedidoOracao.find({ messageId: { $ne: null } }).select('messageId').lean()).map((p) => String(p.messageId)));
  const logs = await Message.find({ tipo: 'oracao' }).select('conteudo origemNome origemCongregacao enviadoPor criadoEm createdAt').lean();
  let n = 0;
  for (const m of logs) {
    if (jaImportados.has(String(m._id))) continue;
    const hit = String(m.conteudo || '').match(PEDIDO_RE);
    if (!hit) continue;
    const [nomeLinha, texto] = [hit[1], hit[2].trim()];
    const congregacao = m.origemCongregacao || (nomeLinha.includes(' - ') ? nomeLinha.split(' - ').pop() : undefined);
    const nome = m.origemNome || nomeLinha.split(' - ')[0];
    const data = m.criadoEm || m.createdAt || new Date();
    await PedidoOracao.create({
      nome, congregacao, texto, origem: 'importado', userId: m.enviadoPor, messageId: m._id, createdAt: data, updatedAt: data,
    }).then(() => { n += 1; }).catch(() => {});
  }
  return n;
};

module.exports = { churchNumber, pedidoRecente, registrarPedido, listarPedidos, marcarStatus, importarPedidosAntigos };
