const Escala = require('../models/Escala.model');
const Person = require('../models/Person.model');
const Conversation = require('../models/Conversation.model');
const Message = require('../models/Message.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');
const { escapeRegex } = require('../utils/sanitize');
const { getTenant } = require('../tenancy/context');
const { timezone } = require('../tenancy/brand');
const { formatBr, zonedParts, addDaysIso } = require('../utils/time');

/**
 * Escala de voluntários:
 *  - convite no WhatsApp com "1 Confirmo / 2 Não posso" (a conversa do voluntário fica no estado
 *    `escala_convite`, respondido sem IA em inbound.service);
 *  - recusa → o responsável recebe sugestões de substituto (estado `escala_substituto`, menu do líder);
 *  - lembrete na véspera para quem confirmou.
 * Todos os envios passam pela fila anti-ban (sendBatch).
 */
const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dataExtenso = (d) => {
  const dt = new Date(d);
  return `${DIAS_PT[dt.getUTCDay()].replace(/^./, (c) => c.toUpperCase())}, ${formatBr(dt)}`;
};
const dadosConvite = (e, item) => ({
  ministerio: e.ministerio, funcao: item.funcao, data: dataExtenso(e.data), horario: e.horario,
  evento: e.evento, congregacao: e.congregacao, observacao: e.observacao,
});
const chaveDe = (celular) => whatsapp.sanitizeNumber(celular);

// Deixa a conversa do voluntário pronta para o "1/2" (sem IA).
const prepararConversa = (celular, nome, escalaId, itemId) => Conversation.findOneAndUpdate(
  { canal: 'whatsapp', chave: chaveDe(celular) },
  { $setOnInsert: { canal: 'whatsapp', chave: chaveDe(celular) }, $set: { nome, state: { tipo: 'escala_convite', escalaId: String(escalaId), itemId: String(itemId) } } },
  { upsert: true },
);

const enviarConvites = async (escalaId, { itemIds } = {}) => {
  const escala = await Escala.findById(escalaId).lean();
  if (!escala || escala.cancelada) throw Object.assign(new Error('Escala não encontrada'), { status: 404 });
  const alvo = escala.itens.filter((it) => it.status === 'pendente' && it.celular && (!itemIds || itemIds.includes(String(it._id))));
  if (!alvo.length) return 0;
  const envios = alvo.map((it) => ({ nome: it.nome, celular: it.celular, itemId: it._id, texto: templates.escalaConvite(it.nome, dadosConvite(escala, it)) }));
  await whatsapp.sendBatch(envios, (d) => d.texto, {
    onSuccess: async (d) => {
      await Escala.updateOne({ _id: escala._id, 'itens._id': d.itemId }, { $set: { 'itens.$.conviteEnviadoEm': new Date() } });
      await prepararConversa(d.celular, d.nome, escala._id, d.itemId);
      await Message.create({ tipo: 'escala', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'concluido' }], conteudo: d.texto, status: 'concluido', origemNome: d.nome, origemCongregacao: escala.congregacao, concluidoEm: new Date() }).catch(() => {});
    },
    onError: (d, err) => Message.create({ tipo: 'escala', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'erro' }], conteudo: d.texto, status: 'erro', erros: [{ celular: d.celular, motivo: err.message }] }).catch(() => {}),
  });
  return envios.length;
};

// Substitutos (com celular, ativos, fora desta escala e sem outra escala no mesmo dia), na ordem:
// 1º quem tem a mesma função no cadastro ("Vocal" ↔ "Vocais"), 2º quem já serviu neste ministério,
// 3º quem tem o ministério no cadastro.
const raiz = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().split(/\s+/)[0].slice(0, 4);
const sugestoesSubstituto = async (escala, limite = 5, funcao) => {
  const naEscala = new Set(escala.itens.map((it) => String(it.personId)));
  const mesmoDia = await Escala.find({ data: escala.data, cancelada: { $ne: true }, _id: { $ne: escala._id } }).select('itens.personId').lean();
  mesmoDia.forEach((e) => e.itens.forEach((it) => naEscala.add(String(it.personId))));
  const jaServiram = (await Escala.distinct('itens.personId', { ministerio: escala.ministerio, 'itens.status': 'confirmado' })).map(String);
  const rFuncao = raiz(funcao);
  const rMinisterio = raiz(escala.ministerio);
  const ou = [{ _id: { $in: jaServiram } }];
  if (rMinisterio.length >= 3) ou.push({ ministerio: new RegExp(escapeRegex(rMinisterio), 'i') });
  if (rFuncao.length >= 3) ou.push({ ministerio: new RegExp(escapeRegex(rFuncao), 'i') });
  const candidatos = await Person.find({ status: 'ativo', celular: { $nin: [null, ''] }, congregacao: escala.congregacao, $or: ou })
    .select('nome ministerio').limit(60).lean();
  const peso = (p) => {
    const sem = String(p.ministerio || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (rFuncao.length >= 3 && sem.includes(rFuncao.toLowerCase())) return 0;
    if (jaServiram.includes(String(p._id))) return 1;
    return 2;
  };
  return candidatos
    .filter((p) => !naEscala.has(String(p._id)))
    .sort((x, y) => peso(x) - peso(y) || String(x.nome).localeCompare(String(y.nome), 'pt-BR'))
    .slice(0, limite)
    .map((p) => ({ id: String(p._id), nome: p.nome }));
};

// Responsável pela escala (ou quem criou) recebe as respostas importantes no WhatsApp.
const avisarResponsavel = async (escala, texto, state) => {
  const celular = escala.responsavelCelular;
  if (!celular) return false;
  await whatsapp.sendText(celular, texto);
  if (state) {
    await Conversation.findOneAndUpdate(
      { canal: 'whatsapp', chave: chaveDe(celular) },
      { $setOnInsert: { canal: 'whatsapp', chave: chaveDe(celular) }, $set: { state } },
      { upsert: true },
    );
  }
  return true;
};

const CONFIRMA_RE = /^\s*(1|sim|confirmo|confirmado|confirmada|pode contar|estarei|ok|✅)\b/i;
const RECUSA_RE = /^\s*(2|n[aã]o( posso)?|nao posso|não vou|nao vou|❌)\b/i;

/**
 * Resposta do voluntário (estado `escala_convite`). Retorna o texto de resposta ou null
 * (mensagem que não é resposta ao convite segue o fluxo normal).
 */
const responderConvite = async ({ conversation, text }) => {
  const st = conversation.state;
  const confirmou = CONFIRMA_RE.test(text);
  const recusou = !confirmou && RECUSA_RE.test(text);
  if (!confirmou && !recusou) return null;
  const escala = await Escala.findById(st.escalaId);
  const item = escala?.itens.id(st.itemId);
  conversation.state = null;
  if (!escala || !item || escala.cancelada) return 'Essa escala não está mais ativa. Obrigado! 🙏';
  item.status = confirmou ? 'confirmado' : 'recusado';
  item.respondidoEm = new Date();
  if (recusou) item.motivoRecusa = String(text).replace(RECUSA_RE, '').replace(/^[\s,.:-]+/, '').slice(0, 200) || undefined;
  await escala.save();

  if (recusou) {
    const sugestoes = await sugestoesSubstituto(escala, 5, item.funcao);
    await avisarResponsavel(escala, templates.escalaRecusaLider({
      ministerio: escala.ministerio, data: dataExtenso(escala.data), nome: item.nome, funcao: item.funcao, motivo: item.motivoRecusa, sugestoes,
    }), sugestoes.length ? { tipo: 'escala_substituto', escalaId: String(escala._id), itemId: String(item._id), sugestoes } : null)
      .catch((err) => console.error('[ESCALA] Falha ao avisar responsável:', err.message));
  }
  // Há outro convite pendente para esta pessoa? Deixa a conversa pronta para ele.
  const outra = await Escala.findOne({
    _id: { $ne: escala._id }, cancelada: { $ne: true }, data: { $gte: new Date(Date.now() - 864e5) },
    itens: { $elemMatch: { personId: item.personId, status: 'pendente', conviteEnviadoEm: { $ne: null } } },
  }).lean();
  if (outra) {
    const it = outra.itens.find((i) => String(i.personId) === String(item.personId) && i.status === 'pendente');
    conversation.state = { tipo: 'escala_convite', escalaId: String(outra._id), itemId: String(it._id) };
  }
  return confirmou ? templates.escalaConfirmado(item.nome) : templates.escalaRecusadoMembro(item.nome);
};

// O líder escolheu um substituto (menu): entra na escala e recebe o convite.
const convidarSubstituto = async ({ escalaId, itemId, personId }) => {
  const escala = await Escala.findById(escalaId);
  const original = escala?.itens.id(itemId);
  if (!escala || !original) throw Object.assign(new Error('Escala não encontrada'), { toolError: true });
  const person = await Person.findById(personId).select('nome celular').lean();
  if (!person?.celular) throw Object.assign(new Error('Essa pessoa não tem celular cadastrado.'), { toolError: true });
  escala.itens.push({ funcao: original.funcao, personId: person._id, nome: person.nome, celular: person.celular, substituiu: original.nome });
  await escala.save();
  const novo = escala.itens[escala.itens.length - 1];
  await enviarConvites(escala._id, { itemIds: [String(novo._id)] });
  return { nome: person.nome, funcao: original.funcao };
};

// Véspera, no horário configurado: lembrete para quem confirmou; responsável vê quem ainda não respondeu.
const runLembretes = async () => {
  const amanha = addDaysIso(zonedParts(timezone()).isoDate, 1);
  const escalas = await Escala.find({ data: new Date(`${amanha}T12:00:00Z`), cancelada: { $ne: true } }).lean();
  let enviados = 0;
  for (const e of escalas) {
    const confirmados = e.itens.filter((it) => it.status === 'confirmado' && it.celular && !it.lembreteEnviadoEm);
    if (confirmados.length) {
      await whatsapp.sendBatch(
        confirmados.map((it) => ({ nome: it.nome, celular: it.celular, itemId: it._id, texto: templates.escalaLembrete(it.nome, dadosConvite(e, it)) })),
        (d) => d.texto,
        { onSuccess: (d) => Escala.updateOne({ _id: e._id, 'itens._id': d.itemId }, { $set: { 'itens.$.lembreteEnviadoEm': new Date() } }) },
      );
      enviados += confirmados.length;
    }
    const pendentes = e.itens.filter((it) => it.status === 'pendente');
    if (pendentes.length && e.responsavelCelular) {
      await whatsapp.sendText(e.responsavelCelular, `⏳ *Escala de amanhã: ${e.ministerio}*\nAinda sem resposta: ${pendentes.map((p) => `${p.nome} (${p.funcao})`).join(', ')}.\n\nResponda *menu → 13* para reenviar os convites.`, { bulk: true })
        .catch((err) => console.error('[ESCALA] Aviso de pendentes:', err.message));
    }
  }
  return enviados;
};

const resumoEscala = (e) => ({
  id: String(e._id), ministerio: e.ministerio, evento: e.evento, congregacao: e.congregacao,
  data: dataExtenso(e.data), horario: e.horario,
  confirmados: e.itens.filter((i) => i.status === 'confirmado').length,
  pendentes: e.itens.filter((i) => i.status === 'pendente').length,
  recusados: e.itens.filter((i) => i.status === 'recusado').length,
  itens: e.itens,
});

const proximasEscalas = (filtro = {}, dias = 14) => {
  const hoje = new Date(`${zonedParts(timezone()).isoDate}T00:00:00Z`);
  return Escala.find({ ...filtro, cancelada: { $ne: true }, data: { $gte: hoje, $lte: new Date(hoje.getTime() + dias * 864e5) } }).sort({ data: 1, horario: 1 }).lean();
};

module.exports = {
  enviarConvites, responderConvite, convidarSubstituto, sugestoesSubstituto, runLembretes, resumoEscala, proximasEscalas, dataExtenso,
  CONFIRMA_RE, RECUSA_RE,
};
