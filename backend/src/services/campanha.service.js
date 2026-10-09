const Campanha = require('../models/Campanha.model');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');
const optout = require('./optout.service');
const { getTenant } = require('../tenancy/context');
const { timezone } = require('../tenancy/brand');
const { zonedParts, addDaysIso } = require('../utils/time');

/**
 * Motor de campanhas (envio em massa retomável). Regras:
 *  - um lote por vez por igreja (LOTE mensagens), sempre pela fila anti-ban (intervalo, janela, limites);
 *  - limite diário atingido → itens voltam para "pendente" e a campanha pausa até 08:00 do dia seguinte;
 *  - descadastrados (SAIR) entram como "bloqueado" e nunca recebem;
 *  - texto personalizado com {nome} e rodapé de como sair.
 */
const LOTE = 30;
const emAndamento = new Set(); // tenantId com lote na fila

const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';
const textoPara = (c, d) => `${String(c.texto).replace(/\{nome\}/gi, primeiroNome(d.nome))}${templates.rodapeSair()}`;

// Pessoas ativas com celular, no escopo informado. Descadastrados já marcados como bloqueados.
const montarPublico = async ({ congregacao, congregacoes, tipos = [], pessoas } = {}) => {
  const filtro = { status: 'ativo', celular: { $nin: [null, ''] } };
  if (pessoas) filtro._id = { $in: pessoas };
  if (congregacao) filtro.congregacao = congregacao;
  else if (congregacoes?.length) filtro.congregacao = { $in: congregacoes };
  if (tipos.length) filtro.tipo = { $in: tipos };
  const lista = await Person.find(filtro).select('nome celular').sort({ nome: 1 }).lean();
  const vistos = new Set();
  const out = [];
  for (const p of lista) {
    const k = String(p.celular).replace(/\D/g, '').slice(-8);
    if (vistos.has(k)) continue; // mesmo número em dois cadastros recebe uma vez
    vistos.add(k);
    out.push({ personId: p._id, nome: p.nome, celular: p.celular, status: (await optout.bloqueado(p.celular)) ? 'bloqueado' : 'pendente' });
  }
  return out;
};

const criar = async ({ tipo, titulo, texto, publico = {}, destinatarios, enviarApos, eventoId, user, avisarCelular }) => {
  const lista = destinatarios || await montarPublico(publico);
  return Campanha.create({
    tipo, titulo, texto, publico: { congregacao: publico.congregacao, tipos: publico.tipos || [], descricao: publico.descricao },
    destinatarios: lista, enviarApos: enviarApos || new Date(), eventoId,
    criadoPor: user?._id || user?.userId, criadoPorNome: user?.nome, avisarCelular,
  });
};

const resumo = (c) => {
  const conta = (s) => c.destinatarios.filter((d) => d.status === s).length;
  const total = c.destinatarios.length;
  const enviados = conta('enviado');
  return {
    id: String(c._id), tipo: c.tipo, titulo: c.titulo, status: c.status, enviarApos: c.enviarApos, pausadaAte: c.pausadaAte,
    total, enviados, pendentes: conta('pendente') + conta('enviando'), erros: conta('erro'), bloqueados: conta('bloqueado'),
    progresso: total ? Math.round(((enviados + conta('erro') + conta('bloqueado')) / total) * 100) : 100,
    // ~50 mensagens/hora e até 400/dia pelo anti-ban: estimativa de dias para concluir
    diasEstimados: Math.max(1, Math.ceil((conta('pendente') + conta('enviando')) / 350)),
    criadoPorNome: c.criadoPorNome, createdAt: c.createdAt, publico: c.publico,
  };
};

const amanha8h = () => new Date(`${addDaysIso(zonedParts(timezone()).isoDate, 1)}T08:00:00`);

const marcar = (campanhaId, personIdOuCel, patch) => Campanha.updateOne(
  { _id: campanhaId },
  { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`destinatarios.$[d].${k}`, v])) },
  { arrayFilters: [personIdOuCel.personId ? { 'd.personId': personIdOuCel.personId } : { 'd.celular': personIdOuCel.celular }] },
);

const finalizarSePronto = async (campanhaId) => {
  const c = await Campanha.findById(campanhaId).lean();
  if (!c || c.status === 'cancelada') return;
  if (c.destinatarios.some((d) => ['pendente', 'enviando'].includes(d.status))) return;
  await Campanha.updateOne({ _id: c._id }, { $set: { status: 'concluida', concluidaEm: new Date() } });
  if (c.avisarCelular) {
    const r = resumo(c);
    await whatsapp.sendText(c.avisarCelular, templates.campanhaConcluida({ titulo: c.titulo, ...r })).catch(() => {});
  }
};

// Um lote da próxima campanha vencida (chamado pelo scheduler a cada tick).
const runCampanhas = async () => {
  const tenantId = String(getTenant()?._id || '');
  if (!tenantId || emAndamento.has(tenantId)) return null;
  const agora = new Date();
  const c = await Campanha.findOne({
    status: { $in: ['agendada', 'enviando', 'pausada'] },
    enviarApos: { $lte: agora },
    $or: [{ pausadaAte: null }, { pausadaAte: { $lte: agora } }],
  }).sort({ enviarApos: 1 }).lean();
  if (!c) return null;
  const lote = c.destinatarios.filter((d) => d.status === 'pendente').slice(0, LOTE);
  if (!lote.length) {
    await finalizarSePronto(c._id);
    return null;
  }
  emAndamento.add(tenantId);
  await Campanha.updateOne({ _id: c._id }, { $set: { status: 'enviando', pausadaAte: null } });
  await Promise.all(lote.map((d) => marcar(c._id, d, { status: 'enviando' })));
  let restantes = lote.length;
  let pausou = false;
  const fim = async () => {
    restantes -= 1;
    if (restantes > 0) return;
    emAndamento.delete(tenantId);
    if (!pausou) await finalizarSePronto(c._id);
  };
  await whatsapp.sendBatch(lote.map((d) => ({ ...d })), (d) => textoPara(c, d), {
    onSuccess: async (d) => {
      await marcar(c._id, d, { status: 'enviado', em: new Date() });
      await Message.create({ tipo: 'campanha', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'concluido' }], conteudo: textoPara(c, d), status: 'concluido', origemNome: c.criadoPorNome, concluidoEm: new Date() }).catch(() => {});
      await fim();
    },
    onError: async (d, err) => {
      if (err.code === 'ANTIBAN_DAILY') {
        pausou = true;
        await marcar(c._id, d, { status: 'pendente' });
        await Campanha.updateOne({ _id: c._id, status: { $ne: 'cancelada' } }, { $set: { status: 'pausada', pausadaAte: amanha8h() } });
      } else {
        await marcar(c._id, d, { status: err.code === 'OPT_OUT' ? 'bloqueado' : 'erro', em: new Date(), erro: String(err.message).slice(0, 200) });
      }
      await fim();
    },
  });
  return { campanha: c.titulo, lote: lote.length };
};

// Após reinício do servidor, itens que estavam "enviando" voltam para a fila.
const recuperarInterrompidas = () => Campanha.updateMany(
  { 'destinatarios.status': 'enviando' },
  { $set: { 'destinatarios.$[d].status': 'pendente' } },
  { arrayFilters: [{ 'd.status': 'enviando' }] },
);

const cancelar = (id) => Campanha.findOneAndUpdate({ _id: id, status: { $in: ['agendada', 'enviando', 'pausada'] } }, { $set: { status: 'cancelada' } }, { new: true }).lean();

module.exports = { LOTE, montarPublico, criar, resumo, runCampanhas, recuperarInterrompidas, cancelar, textoPara };
