const Jornada = require('../models/Jornada.model');
const Person = require('../models/Person.model');
const EbdAula = require('../models/EbdAula.model');
const Encontro = require('../models/Encontro.model');
const Culto = require('../models/Culto.model');
const GrupoEncontro = require('../models/GrupoEncontro.model');
const Message = require('../models/Message.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');
const { notifyLeadership } = require('./leadership.service');
const { GRUPO_TO_CLASSE } = require('./ebd.service');
const { calculateAge, determineGroup } = require('../utils/person-rules');
const { hasFeature } = require('../config/plans');
const { getTenant } = require('../tenancy/context');
const { formatBr } = require('../utils/time');

/**
 * Jornada de 30 dias do visitante / novo decidido (sem IA, só templates):
 *   d3  como foi a visita / a primeira semana
 *   d7  convite para a união/grupo certo (por sexo e idade)
 *   d14 convite à EBD (classe da idade) — para o novo decidido, como discipulado
 *   d21 visitante: "sentimos sua falta" (pulada se já voltou) · novo decidido: convite ao batismo
 *   d30 resumo à liderança: quem voltou e quem precisa de contato
 * "Voltou" = presença na EBD, num encontro ou check-in de culto depois do dia da visita.
 */
const ETAPAS = [
  { chave: 'd3', dia: 3 },
  { chave: 'd7', dia: 7 },
  { chave: 'd14', dia: 14 },
  { chave: 'd21', dia: 21 },
  { chave: 'd30', dia: 30 }, // liderança (não vai para a pessoa)
];
const TIPOS = ['visitante', 'novo decidido'];
const DIA_MS = 864e5;
const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const jornadaLigada = (tenant = getTenant()) => hasFeature(tenant, 'jornadaVisitante') && tenant?.automacoes?.jornada?.ativo !== false;
const diasDesde = (inicio) => Math.floor((Date.now() - new Date(inicio).getTime()) / DIA_MS);
// Fim do dia da visita: presença no próprio dia é a visita, não um retorno.
const depoisDoDia = (inicio) => new Date(new Date(inicio).setHours(23, 59, 59, 999));

// Inicia (idempotente) a jornada de quem acabou de ser cadastrado como visitante/novo decidido.
const iniciarJornada = async (person) => {
  if (!person || !TIPOS.includes(person.tipo) || person.status === 'inativo' || !jornadaLigada()) return null;
  const inicio = person.tipo === 'novo decidido' ? (person.dataDecisao || new Date()) : (person.dataVisita || new Date());
  return Jornada.findOneAndUpdate(
    { personId: person._id },
    {
      $setOnInsert: {
        personId: person._id, nome: person.nome, celular: person.celular, congregacao: person.congregacao,
        tipo: person.tipo, inicio, status: 'ativa', etapas: ETAPAS.map((e) => ({ chave: e.chave, dia: e.dia })),
      },
    },
    { upsert: true, new: true },
  ).lean();
};

// Grupo que combina com a pessoa (mesma congregação; critérios de sexo/idade), o mais específico primeiro.
const grupoSugerido = async (person) => {
  const idade = calculateAge(person.dataNascimento);
  const grupos = await GrupoEncontro.find({ ativo: true, congregacao: person.congregacao, tipo: { $ne: 'ebd' } })
    .select('nome diaSemana horario local criterios').lean();
  const servem = grupos.filter((g) => {
    const c = g.criterios || {};
    if (c.sexo && person.sexo && c.sexo !== person.sexo) return false;
    if (idade !== null && ((c.idadeMin && idade < c.idadeMin) || (c.idadeMax && idade > c.idadeMax))) return false;
    if (idade === null && c.idadeMin) return false;
    return true;
  });
  const especificidade = (g) => (g.criterios?.sexo ? 1 : 0) + (g.criterios?.idadeMin || g.criterios?.idadeMax ? 1 : 0);
  const g = servem.sort((a, b) => especificidade(b) - especificidade(a))[0];
  return g ? { nome: g.nome, dia: DIAS_PT[g.diaSemana], horario: g.horario, local: g.local } : null;
};

const classeEbd = (person) => GRUPO_TO_CLASSE[person.grupo || determineGroup(calculateAge(person.dataNascimento))] || null;

// Presença depois do dia da visita (EBD, encontro de grupo ou check-in de culto).
const buscarRetorno = async (j) => {
  const desde = depoisDoDia(j.inicio);
  const presente = { $elemMatch: { personId: j.personId, presente: true } };
  const [aula, encontro, culto] = await Promise.all([
    EbdAula.findOne({ data: { $gt: desde }, presencas: presente }).sort({ data: 1 }).select('data classe').lean(),
    Encontro.findOne({ data: { $gt: desde }, ebdAulaId: null, presencas: presente }).sort({ data: 1 }).select('data grupoNome').lean(),
    Culto.findOne({ data: { $gt: desde }, 'presencas.personId': j.personId }).sort({ data: 1 }).select('data titulo').lean(),
  ]);
  const opcoes = [
    aula && { em: aula.data, onde: `EBD ${aula.classe} ${formatBr(aula.data)}` },
    encontro && { em: encontro.data, onde: `${encontro.grupoNome} ${formatBr(encontro.data)}` },
    culto && { em: culto.data, onde: `${culto.titulo} ${formatBr(culto.data)}` },
  ].filter(Boolean).sort((a, b) => new Date(a.em) - new Date(b.em));
  return opcoes[0] || null;
};

// Chamado no check-in do culto (retorno imediato, sem esperar o ciclo diário).
const marcarRetorno = async (personId, onde) => {
  const j = await Jornada.findOne({ personId, status: 'ativa', retornou: false }).lean();
  if (!j || Date.now() <= depoisDoDia(j.inicio).getTime()) return;
  await Jornada.updateOne({ _id: j._id }, { $set: { retornou: true, retornouEm: new Date(), retornouOnde: onde } });
};

const marcarResposta = (personId) => (personId
  ? Jornada.updateOne({ personId, status: 'ativa' }, { $set: { respondeuEm: new Date() } }).catch(() => {})
  : null);

const textoDaEtapa = async (chave, j, person) => {
  if (chave === 'd3') return templates.jornadaD3(person.nome, j.tipo);
  if (chave === 'd7') return templates.jornadaD7(person.nome, await grupoSugerido(person));
  if (chave === 'd14') return templates.jornadaD14(person.nome, j.tipo, classeEbd(person));
  if (chave === 'd21') return templates.jornadaD21(person.nome, j.tipo);
  return null;
};

/**
 * Ciclo diário (scheduler, no horário da igreja). Para cada jornada ativa: atualiza o retorno,
 * envia a etapa vencida mais recente (as anteriores atrasadas são puladas para não acumular
 * mensagens) e, no dia 30, encerra e junta a pessoa no resumo para a liderança.
 */
const runJornadas = async () => {
  if (!jornadaLigada()) return { enviadas: 0, concluidas: 0 };
  const jornadas = await Jornada.find({ status: 'ativa' }).lean();
  const envios = [];
  const concluidas = [];

  for (const j of jornadas) {
    const person = await Person.findById(j.personId).lean();
    if (!person || person.status === 'inativo') {
      await Jornada.updateOne({ _id: j._id }, { $set: { status: 'cancelada', canceladaMotivo: person ? 'pessoa inativa' : 'cadastro removido' } });
      continue;
    }
    const set = {};
    if (!j.retornou) {
      const r = await buscarRetorno(j);
      if (r) Object.assign(set, { retornou: true, retornouEm: r.em, retornouOnde: r.onde });
    }
    const retornou = j.retornou || Boolean(set.retornou);
    const dias = diasDesde(j.inicio);
    const vencidas = j.etapas.filter((e) => e.status === 'pendente' && e.dia <= dias);
    const etapas = j.etapas.map((e) => ({ ...e }));
    const marcar = (chave, patch) => Object.assign(etapas.find((e) => e.chave === chave), patch);

    const daPessoa = vencidas.filter((e) => e.chave !== 'd30');
    const enviar = daPessoa[daPessoa.length - 1];
    daPessoa.slice(0, -1).forEach((e) => marcar(e.chave, { status: 'pulada' }));
    if (enviar) {
      const pular = !person.celular || (enviar.chave === 'd21' && j.tipo === 'visitante' && retornou);
      if (pular) marcar(enviar.chave, { status: 'pulada' });
      else envios.push({ jornadaId: j._id, chave: enviar.chave, nome: person.nome, celular: person.celular, texto: await textoDaEtapa(enviar.chave, j, person) });
    }
    if (vencidas.some((e) => e.chave === 'd30')) {
      marcar('d30', { status: 'enviada', enviadaEm: new Date() });
      set.status = 'concluida';
      concluidas.push({
        nome: person.nome, tipo: j.tipo, congregacao: person.congregacao, celular: person.celular,
        retornou, onde: set.retornouOnde || j.retornouOnde,
      });
    }
    await Jornada.updateOne({ _id: j._id }, { $set: { ...set, etapas } });
  }

  if (envios.length) {
    const marcarEtapa = (d, patch) => Jornada.updateOne(
      { _id: d.jornadaId, 'etapas.chave': d.chave },
      { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`etapas.$.${k}`, v])) },
    );
    await whatsapp.sendBatch(envios, (d) => d.texto, {
      onSuccess: async (d) => {
        await marcarEtapa(d, { status: 'enviada', enviadaEm: new Date() });
        await Message.create({ tipo: 'jornada', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'concluido' }], conteudo: d.texto, status: 'concluido', origemNome: d.nome, concluidoEm: new Date() }).catch(() => {});
      },
      onError: async (d, err) => {
        await marcarEtapa(d, { status: 'erro', erro: err.message });
        await Message.create({ tipo: 'jornada', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'erro' }], conteudo: d.texto, status: 'erro', erros: [{ celular: d.celular, motivo: err.message }] }).catch(() => {});
      },
    });
  }

  if (concluidas.length && getTenant()?.automacoes?.jornada?.avisarLideranca !== false) {
    await notifyLeadership({
      tipo: 'ausencias',
      texto: templates.jornadaLideranca(concluidas),
      emailSubject: `Jornada de 30 dias: ${concluidas.filter((c) => !c.retornou).length} pessoa(s) ainda não voltaram`,
    }).catch((err) => console.error('[JORNADA] Falha ao avisar a liderança:', err.message));
  }
  return { enviadas: envios.length, concluidas: concluidas.length };
};

// Jornadas ativas (e as concluídas há pouco) para o líder: WhatsApp (menu 12) e web.
const listarJornadas = async ({ filtro = {}, incluirConcluidas = false } = {}) => {
  const status = incluirConcluidas ? { $in: ['ativa', 'concluida'] } : 'ativa';
  const desde = new Date(Date.now() - 45 * DIA_MS);
  const lista = await Jornada.find({ ...filtro, status, inicio: { $gte: desde } }).sort({ retornou: 1, inicio: 1 }).lean();
  return lista.map((j) => ({
    ...j,
    dia: Math.min(30, diasDesde(j.inicio)),
    proxima: j.etapas.find((e) => e.status === 'pendente')?.chave || null,
  }));
};

module.exports = {
  ETAPAS, iniciarJornada, runJornadas, marcarRetorno, marcarResposta, listarJornadas, grupoSugerido, classeEbd, buscarRetorno,
};
