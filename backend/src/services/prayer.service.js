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
// `confidencial` não informado (ex.: pedido feito conversando com a IA) = confidencial:
// só vai para a rede de intercessores quando a pessoa autorizou explicitamente.
const registrarPedido = async ({ nome, personId, userId, celular, congregacao, texto, origem = 'web', enviadoPor, confidencial }) => {
  const pedido = await PedidoOracao.create({ nome, personId, userId, celular, congregacao, texto, origem, confidencial: confidencial === undefined ? true : Boolean(confidencial) });
  // Rede de intercessores (não confidenciais) + "estamos orando por você" para quem pediu.
  // Sem await: o lote segue o ritmo anti-ban (minutos, com fila cheia) e não pode segurar a resposta.
  avisarIntercessores(pedido).catch((err) => console.error('[ORAÇÃO] Intercessores:', err.message));
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

// ── Rede de intercessores ─────────────────────────────────────────────
// Pessoas marcadas como intercessoras (Person.intercessor) recebem os pedidos NÃO confidenciais,
// só com o primeiro nome de quem pediu. Quem pediu recebe a confirmação de que estão orando.
const intercessoresDa = (congregacao) => {
  const Person = require('../models/Person.model');
  const filtro = { intercessor: true, status: 'ativo', celular: { $nin: [null, ''] } };
  return Person.find(filtro).select('nome celular congregacao').lean()
    .then((lista) => lista.filter((p) => !congregacao || !p.congregacao || p.congregacao === congregacao || lista.length <= 15));
};

const avisarIntercessores = async (pedido) => {
  if (pedido.confidencial) return 0;
  const intercessores = (await intercessoresDa(pedido.congregacao))
    .filter((p) => !pedido.personId || String(p._id) !== String(pedido.personId));
  if (!intercessores.length) return 0;
  const texto = templates.intercessaoPedido(pedido.nome, pedido.texto);
  await whatsapp.sendBatch(intercessores.map((p) => ({ nome: p.nome, celular: p.celular })), texto, {
    onError: (d, err) => console.warn(`[ORAÇÃO] Intercessor ${d.nome}: ${err.message}`),
  });
  await PedidoOracao.updateOne({ _id: pedido._id }, { $set: { intercessoresAvisados: intercessores.length } });
  if (pedido.celular) {
    await whatsapp.sendText(pedido.celular, templates.intercessaoConfirmacao(pedido.nome, intercessores.length), { bulk: true })
      .catch((err) => console.warn('[ORAÇÃO] Confirmação ao solicitante:', err.message));
  }
  return intercessores.length;
};

// 7 dias depois: "como está o seu pedido?" (1x por pedido, só com celular e não confidencial).
const runAcompanhamentos = async () => {
  const fim = new Date(Date.now() - 7 * 864e5);
  const inicio = new Date(Date.now() - 10 * 864e5);
  const pedidos = await PedidoOracao.find({ createdAt: { $gte: inicio, $lte: fim }, acompanhamentoEm: null, celular: { $nin: [null, ''] }, status: { $ne: 'arquivado' } }).limit(50).lean();
  if (!pedidos.length) return 0;
  await whatsapp.sendBatch(pedidos.map((p) => ({ nome: p.nome, celular: p.celular, id: p._id })), (d) => templates.intercessaoAcompanhamento(d.nome), {
    onSuccess: (d) => PedidoOracao.updateOne({ _id: d.id }, { $set: { acompanhamentoEm: new Date() } }),
    onError: (d) => PedidoOracao.updateOne({ _id: d.id }, { $set: { acompanhamentoEm: new Date() } }), // não insiste (inclui SAIR)
  });
  return pedidos.length;
};

const listarPedidos = ({ filtroCongregacao = {}, dias = 30, status, limite = 200 } = {}) => {
  const filter = { ...filtroCongregacao, createdAt: { $gte: new Date(Date.now() - dias * 864e5) } };
  if (status) filter.status = status;
  return PedidoOracao.find(filter).sort({ createdAt: -1 }).limit(limite).lean();
};

// filtroCongregacao: escopo do admin (só pedidos das congregações que ele gere)
const marcarStatus = (id, status, por, filtroCongregacao = {}) => PedidoOracao.findOneAndUpdate(
  { ...filtroCongregacao, _id: id },
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

module.exports = {
  avisarIntercessores,
  runAcompanhamentos, churchNumber, pedidoRecente, registrarPedido, listarPedidos, marcarStatus, importarPedidosAntigos };
