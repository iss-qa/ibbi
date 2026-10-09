const Person = require('../../models/Person.model');
const Encontro = require('../../models/Encontro.model');
const GrupoEncontro = require('../../models/GrupoEncontro.model');
const templates = require('../../templates/messages.templates');
const ebd = require('../ebd.service');
const encontrosSvc = require('../encontro.service');
const engagement = require('../engagement.service');
const { generateText } = require('./llm');
const CareAlert = require('../../models/CareAlert.model');
const PedidoOracao = require('../../models/PedidoOracao.model');
const whatsapp = require('../whatsapp.service');
const prayer = require('../prayer.service');
const cultoSvc = require('../culto.service');
const escalaSvc = require('../escala.service');
const jornadaSvc = require('../jornada.service');
const Culto = require('../../models/Culto.model');
const Escala = require('../../models/Escala.model');
const { hasFeature } = require('../../config/plans');
const campanhaSvc = require('../campanha.service');
const sermaoSvc = require('../sermao.service');
const eventoSvc = require('../evento.service');
const impactoSvc = require('../impacto.service');
const Evento = require('../../models/Evento.model');
const { runTool, scopeFilter, gruposAcessiveis, buildFicha, sendFotoToActor, formatPhone, DIAS_PT } = require('./tools');
const { getTenant } = require('../../tenancy/context');
const { timezone } = require('../../tenancy/brand');
const { formatBr, zonedParts, addDaysIso } = require('../../utils/time');
const { samePhone } = require('../../utils/phone');

/**
 * Menus guiados do líder no WhatsApp (respostas numeradas, sem IA).
 * Cada passo grava `conversation.state = { tipo, ... }`. Entrada que não é uma opção válida
 * volta `null` e segue para o agente de IA, com `contexto` para ele saber onde o líder estava.
 * Retorno: string (resposta) | { agente: 'pedido em linguagem natural' } | null.
 */

const RESUMO_DELAY_MS = 60 * 60e3;
const RESUMO_MAX_AUDIO_SEG = 125; // 2 min + tolerância
const ATIVIDADES_MENU = ['reuniao', 'culto', 'estudo', 'oracao', 'ensaio', 'evangelismo', 'visita', 'confraternizacao', 'outro'];

// Pedidos ao agente para as opções que dependem de conversa livre.
const PEDIDOS = {
  2: 'Quero cadastrar uma pessoa. Pergunte os dados necessários (nome completo, tipo, idade ou nascimento, sexo, celular com DDD e congregação). Aceite texto, áudio ou foto de ficha.',
  3: 'Quero editar os dados de uma pessoa. Pergunte o nome dela e o que devo alterar (também posso trocar a foto).',
};

// "2", "2.", "opção 2", "dois" → 2
const NUMEROS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13 };
const parseChoice = (text) => {
  const t = ebd.normalize(text).replace(/^(opcao|opção|numero|n)\s*/, '').replace(/[.!)\s]+$/, '').trim();
  if (/^\d{1,2}$/.test(t)) return Number(t);
  return NUMEROS[t] || null;
};

const pick = (lista, n) => (n && n >= 1 && n <= lista.length ? lista[n - 1] : null);
const hoje = () => zonedParts(timezone()).isoDate;
const brIso = (iso) => formatBr(new Date(`${iso}T12:00:00Z`));
const atividadeLabel = (a) => encontrosSvc.ATIVIDADE_LABEL[a] || 'Encontro';

const congregacoesDo = (actor) => {
  if (actor.congregacao) return [actor.congregacao];
  if (actor.congregacoes?.length) return actor.congregacoes;
  return getTenant()?.congregacoes?.length ? getTenant().congregacoes : ['Sede'];
};

// Busca tolerante a acentos: "joao" encontra "João".
const ACENTOS = { a: '[aáàâã]', e: '[eéèê]', i: '[iíì]', o: '[oóòôõ]', u: '[uúùü]', c: '[cç]' };
const nomeRegex = (termo) => new RegExp(ebd.normalize(termo).split('').map((ch) => ACENTOS[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(''), 'i');

// ── Pessoas ──────────────────────────────────────────────────────────────
const mostrarFicha = async (person, ctx) => {
  const ficha = await buildFicha(person);
  await sendFotoToActor(person, ctx.actor, 'whatsapp');
  ctx.conversation.state = { tipo: 'ficha', pessoaId: ficha.id, nome: ficha.nome, contexto: `O líder está vendo a ficha de ${ficha.nome} (id ${ficha.id}).` };
  return templates.fichaPessoa(ficha);
};

const pesquisar = async (termo, ctx) => {
  const t = String(termo || '').trim();
  if (t.length < 2) return templates.pesquisarPessoaPergunta();
  const pessoas = await Person.find(scopeFilter(ctx.actor, { nome: nomeRegex(t) })).sort({ status: 1, nome: 1 }).limit(10).lean();
  if (!pessoas.length) return templates.pesquisaSemResultado(t);
  if (pessoas.length === 1) return mostrarFicha(pessoas[0], ctx);
  ctx.conversation.state = { tipo: 'pesquisa_escolha', ids: pessoas.map((p) => String(p._id)), contexto: `Resultado da pesquisa por "${t}".` };
  return templates.pesquisaVarios(t, pessoas);
};

const atualizarFoto = async (st, media, ctx) => {
  const url = `data:${media.mimetype};base64,${media.base64}`;
  const person = await Person.findOneAndUpdate(scopeFilter(ctx.actor, { _id: st.pessoaId }), { $set: { fotoUrl: url } }, { new: true }).lean();
  if (!person) return 'Não encontrei mais esse cadastro. Pesquise de novo pelo *menu → 1*.';
  ctx.conversation.state = { tipo: 'ficha', pessoaId: st.pessoaId, nome: person.nome, contexto: `O líder está vendo a ficha de ${person.nome} (id ${st.pessoaId}).` };
  return templates.fotoAtualizada(person.nome);
};

// ── Presença: EBD ────────────────────────────────────────────────────────
const escolherClasseEbd = (congregacao, ctx) => {
  ctx.conversation.state = { tipo: 'presenca_classe', congregacao };
  return templates.opcoesNumeradas(`📖 *EBD — ${congregacao}*\nQual classe?`, ebd.CLASSES);
};

const abrirChamadaEbd = async (classe, congregacao, ctx) => {
  const r = await runTool('iniciar_chamada_ebd', { classe, congregacao }, ctx);
  return templates.listaChamada({ titulo: `📖 *EBD ${r.classe}* (${r.congregacao})`, data: r.data, lista: r.lista });
};

const iniciarEbd = async (ctx) => {
  const classes = ctx.actor.classes || [];
  if (classes.length === 1) return abrirChamadaEbd(classes[0].classe, classes[0].congregacao, ctx);
  const congs = congregacoesDo(ctx.actor);
  if (congs.length === 1) return escolherClasseEbd(congs[0], ctx);
  ctx.conversation.state = { tipo: 'presenca_congregacao', congs };
  return templates.opcoesNumeradas('📖 *EBD*\nEm qual congregação?', congs);
};

// ── Presença: uniões/grupos ──────────────────────────────────────────────
const grupoResumo = (g) => ({ id: String(g._id), nome: g.nome, congregacao: g.congregacao, dia: DIAS_PT[g.diaSemana], horario: g.horario, membros: g.membros.length });

// Lista os grupos (pergunta a congregação antes se houver grupos em mais de uma).
const escolherGrupo = async (ctx, { proximo, titulo, congregacao }) => {
  let grupos = (await gruposAcessiveis(ctx.actor)).map(grupoResumo);
  if (!grupos.length) return 'Você ainda não tem grupos disponíveis. Os grupos são criados pela *plataforma web* (menu Encontros).';
  if (congregacao) grupos = grupos.filter((g) => g.congregacao === congregacao);
  const congs = [...new Set(grupos.map((g) => g.congregacao))];
  if (!congregacao && congs.length > 1 && grupos.length > 6) {
    ctx.conversation.state = { tipo: 'grupo_congregacao', congs, proximo, titulo };
    return templates.opcoesNumeradas(`${titulo}\nEm qual congregação?`, congs);
  }
  if (grupos.length === 1) return seguirComGrupo(grupos[0].id, proximo, ctx);
  ctx.conversation.state = { tipo: 'grupo_escolha', ids: grupos.map((g) => g.id), proximo };
  return templates.gruposEscolher(titulo, grupos);
};

const carregarGrupo = async (grupoId, ctx) => (await gruposAcessiveis(ctx.actor)).find((g) => String(g._id) === String(grupoId));

const seguirComGrupo = async (grupoId, proximo, ctx) => {
  const grupo = await carregarGrupo(grupoId, ctx);
  if (!grupo) return 'Não encontrei esse grupo. Digite *menu* para recomeçar.';
  if (proximo === 'membros') return verMembrosGrupo(grupo, ctx);
  if (proximo === 'resumo') return escolherEncontroParaResumo(grupo, ctx);
  if (proximo === 'cuidado') return grupoCuidado(grupo, ctx);
  if (proximo === 'aviso') return pedirAviso(grupo, ctx);
  ctx.conversation.state = { tipo: 'grupo_menu', grupoId: String(grupo._id), contexto: `O líder está no grupo ${grupo.nome} (id ${grupo._id}).` };
  return templates.grupoSubmenu(grupoResumo(grupo));
};

const escolherAtividade = (grupo, ctx) => {
  ctx.conversation.state = { tipo: 'grupo_atividade', grupoId: String(grupo._id) };
  return templates.opcoesNumeradas(`🗓️ *${grupo.nome}* — encontro de hoje (${brIso(hoje())})\nQual foi a atividade?`, ATIVIDADES_MENU.map(atividadeLabel));
};

const abrirChamadaEncontro = async (grupo, { atividade, data }, ctx) => {
  const r = await runTool('iniciar_chamada_encontro', { grupo: String(grupo._id), atividade, data }, ctx);
  return templates.listaChamada({ titulo: `🏷️ *${r.grupo}* · ${atividadeLabel(atividade)}`, data: r.data, lista: r.lista });
};

const ultimosEncontros = (grupo, limite = 8) => Encontro.find({ grupoId: grupo._id }).sort({ data: -1 }).limit(limite).lean();

const listarEncontros = async (grupo, ctx) => {
  const encontros = await ultimosEncontros(grupo);
  ctx.conversation.state = { tipo: 'encontros_lista', grupoId: String(grupo._id), ids: encontros.map((e) => String(e._id)) };
  if (!encontros.length) ctx.conversation.state = { tipo: 'grupo_menu', grupoId: String(grupo._id) };
  return templates.encontrosAnteriores(grupo.nome, encontros.map((e) => ({
    data: formatBr(e.data), atividade: atividadeLabel(e.atividade),
    presentes: e.presencas.filter((p) => p.presente).length, total: e.presencas.length, resumo: Boolean(e.resumo?.texto),
  })));
};

const RESUMO_STATUS = { agendado: 'agendado', enviando: 'enviando', enviado: 'enviado', cancelado: 'cancelado' };
const detalheEncontro = async (encontroId, ctx) => {
  const e = await Encontro.findById(encontroId).lean();
  if (!e) return 'Não encontrei esse encontro. Digite *menu* para recomeçar.';
  ctx.conversation.state = { tipo: 'encontro_detalhe', encontroId: String(e._id), grupoId: String(e.grupoId) };
  const status = e.resumo?.status === 'agendado' && e.resumo.enviarEm
    ? `agendado para ${new Date(e.resumo.enviarEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone() })}; responda *cancelar resumo* para não enviar`
    : RESUMO_STATUS[e.resumo?.status] || 'rascunho';
  return templates.encontroDetalhe({
    grupo: e.grupoNome, data: formatBr(e.data), atividade: atividadeLabel(e.atividade), tema: e.tema,
    presentes: e.presencas.filter((p) => p.presente).map((p) => p.nome),
    ausentes: e.presencas.filter((p) => !p.presente).map((p) => p.nome),
    resumo: e.resumo?.texto, resumoStatus: status,
  });
};

// Reabre a lista do encontro para corrigir (mesma data/atividade → mesmo encontro).
const corrigirPresenca = async (encontroId, ctx) => {
  const e = await Encontro.findById(encontroId).lean();
  if (!e) return 'Não encontrei esse encontro.';
  if (!ebd.canEditAula(e, ctx.actor.role)) return '🔒 Este encontro tem mais de 7 dias e a presença está bloqueada (só o master pode alterar pela plataforma).';
  const roster = [...e.presencas].sort((a, b) => ebd.normalize(a.nome).localeCompare(ebd.normalize(b.nome)));
  const isoDate = new Date(e.data).toISOString().slice(0, 10);
  ctx.conversation.state = {
    tipo: 'chamada_encontro', grupoId: String(e.grupoId), grupoNome: e.grupoNome, data: isoDate, atividade: e.atividade,
    rosterIds: roster.map((p) => String(p.personId)), rosterNomes: roster.map((p) => p.nome),
  };
  return templates.listaChamada({
    titulo: `✏️ *Corrigir presença — ${e.grupoNome}* · ${atividadeLabel(e.atividade)}`,
    data: formatBr(e.data),
    lista: roster.map((p, i) => `${i + 1}. ${p.nome}${p.presente ? ' ✅' : ''}`),
  });
};

// ── Grupos: membros + quem precisa de cuidado neste grupo ────────────────
const verMembrosGrupo = async (grupo, ctx) => {
  const membros = encontrosSvc.sortedMembers(grupo).map((m) => m.nome);
  const stats = await engagement.encontroAttendance({ grupoId: grupo._id, incluirEbd: true });
  const membrosIds = new Set(grupo.membros.map((m) => String(m.personId)));
  const criticos = stats
    .filter((s) => s.nivel && s.faltasConsecutivas >= 2 && membrosIds.has(String(s.personId)))
    .sort((a, b) => b.faltasConsecutivas - a.faltasConsecutivas || b.score - a.score)
    .slice(0, 3)
    .map((s) => ({ nome: s.nome, faltas: s.faltasConsecutivas, ultima: s.ultimaPresenca ? formatBr(s.ultimaPresenca) : 'nunca registrada' }));
  ctx.conversation.state = { tipo: 'grupo_cuidado', grupoId: String(grupo._id), contexto: `O líder está vendo os membros do grupo ${grupo.nome} (id ${grupo._id}).` };
  return templates.grupoMembros({
    grupo: grupo.nome, congregacao: grupo.congregacao, dia: DIAS_PT[grupo.diaSemana], horario: grupo.horario,
    lideres: grupo.lideres.map((l) => l.nome), membros, criticos,
  });
};

// ── Resumo do encontro ───────────────────────────────────────────────────
const escolherEncontroParaResumo = async (grupo, ctx) => {
  const encontros = (await ultimosEncontros(grupo, 5)).filter((e) => Date.now() - new Date(e.data) < 30 * 864e5);
  if (!encontros.length) return templates.resumoSemEncontro(grupo.nome);
  if (encontros.length === 1) return pedirRelato(encontros[0], ctx);
  ctx.conversation.state = { tipo: 'resumo_encontro', ids: encontros.map((e) => String(e._id)) };
  return templates.opcoesNumeradas(`📝 *Resumir encontro — ${grupo.nome}*\nQual encontro?`, encontros.map((e) => `${formatBr(e.data)} · ${atividadeLabel(e.atividade)}${e.resumo?.texto ? ' · 📝 já tem resumo' : ''}`));
};

const pedirRelato = (encontro, ctx) => {
  ctx.conversation.state = { tipo: 'resumo_relato', encontroId: String(encontro._id) };
  return templates.resumoPedirRelato(encontro.grupoNome, formatBr(encontro.data));
};

const organizarResumo = async (relato, encontro) => {
  const texto = await generateText({
    system: [
      'Você organiza o relato de um líder sobre um encontro de um grupo de igreja evangélica em uma mensagem curta de WhatsApp para os membros do grupo.',
      'Use SOMENTE o que o líder contou; não invente datas, nomes, versículos ou decisões. Se algo não foi dito, omita a seção.',
      'Formato: 1 frase de abertura calorosa; depois, quando houver, as seções *📖 Palavra/Pauta*, *✅ Decisões*, *📌 Próximos passos e avisos* com marcadores "• ". Máximo de 900 caracteres.',
      'Português do Brasil, tom pastoral e alegre, *negrito* do WhatsApp. Não cumprimente pelo nome e não assine: isso já é colocado na mensagem.',
    ].join('\n'),
    prompt: `Grupo: ${encontro.grupoNome}\nData: ${formatBr(encontro.data)}\nAtividade: ${atividadeLabel(encontro.atividade)}${encontro.tema ? `\nTema: ${encontro.tema}` : ''}\n\nRelato do líder:\n${relato}`,
    maxTokens: 800,
  }).catch(() => null);
  return (texto || relato).trim().slice(0, 3500);
};

const receberRelato = async (st, relato, ctx) => {
  const encontro = await Encontro.findById(st.encontroId).lean();
  if (!encontro) return 'Não encontrei esse encontro. Digite *menu* para recomeçar.';
  const grupo = await GrupoEncontro.findById(encontro.grupoId).select('membros').lean();
  const destinatarios = (grupo?.membros || []).filter((m) => m.celular).length;
  const texto = await organizarResumo(relato, encontro);
  ctx.conversation.state = { tipo: 'resumo_previa', encontroId: st.encontroId, texto, original: relato.slice(0, 6000), destinatarios };
  return templates.resumoPrevia(texto, destinatarios);
};

const agendarResumo = async (st, ctx) => {
  const enviarEm = new Date(Date.now() + RESUMO_DELAY_MS);
  const encontro = await Encontro.findByIdAndUpdate(st.encontroId, {
    $set: {
      resumo: {
        texto: st.texto, original: st.original, autorNome: ctx.actor.nome, autorId: ctx.actor.userId,
        status: 'agendado', enviarEm, destinatarios: st.destinatarios,
      },
    },
  }, { new: true }).lean();
  ctx.conversation.state = null;
  if (!encontro) return 'Não encontrei esse encontro.';
  const hora = enviarEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: timezone() });
  return templates.resumoAgendado(encontro.grupoNome, hora, st.destinatarios);
};

const cancelarResumo = async (encontroId, ctx) => {
  const r = await Encontro.updateOne({ _id: encontroId, 'resumo.status': 'agendado' }, { $set: { 'resumo.status': 'cancelado' } });
  ctx.conversation.state = null;
  return r.modifiedCount ? '❌ Envio do resumo cancelado. Ele continua salvo no encontro.' : 'Não há resumo agendado para este encontro (talvez já tenha sido enviado).';
};


// ── Cuidado: submenu do grupo (membros, frequência, ausentes 3+, números) ──
const grupoCuidado = (grupo, ctx) => {
  ctx.conversation.state = { tipo: 'grupo_cuidado', grupoId: String(grupo._id), contexto: `O líder está no grupo ${grupo.nome} (id ${grupo._id}).` };
  return templates.grupoCuidadoMenu(grupoResumo(grupo));
};

const pctDe = (e) => (e.presencas.length ? Math.round((e.presencas.filter((p) => p.presente).length / e.presencas.length) * 100) : 0);

const frequenciaGrupo = async (grupo) => {
  const encontros = (await ultimosEncontros(grupo, 8)).filter((e) => e.presencas.length);
  return templates.frequenciaGrupo(grupo.nome, encontros.map((e) => ({
    data: formatBr(e.data), atividade: atividadeLabel(e.atividade), pct: pctDe(e),
    presentes: e.presencas.filter((p) => p.presente).length, total: e.presencas.length,
  })));
};

const statsDoGrupo = async (grupo) => {
  const membrosIds = new Set(grupo.membros.map((m) => String(m.personId)));
  return (await engagement.encontroAttendance({ grupoId: grupo._id, incluirEbd: true }))
    .filter((s) => membrosIds.has(String(s.personId)));
};

const ausentesGrupo = async (grupo, ctx) => {
  const lista = (await statsDoGrupo(grupo))
    .filter((s) => s.faltasConsecutivas >= 3)
    .sort((a, b) => b.faltasConsecutivas - a.faltasConsecutivas)
    .slice(0, 20);
  ctx.conversation.state = {
    tipo: 'faltando_lista', ids: lista.map((s) => String(s.personId)), voltar: { grupoId: String(grupo._id) },
    onde: Object.fromEntries(lista.map((s) => [String(s.personId), [`${grupo.nome}: ${s.faltasConsecutivas} faltas seguidas`]])),
  };
  if (!lista.length) ctx.conversation.state = { tipo: 'grupo_cuidado', grupoId: String(grupo._id) };
  return templates.ausentesGrupo(grupo.nome, lista.map((s) => ({ nome: s.nome, faltas: s.faltasConsecutivas, ultima: s.ultimaPresenca ? formatBr(s.ultimaPresenca) : 'nunca registrada' })));
};

const metricasGrupo = async (grupo) => {
  const desde = new Date(Date.now() - 60 * 864e5);
  const encontros = (await Encontro.find({ grupoId: grupo._id, data: { $gte: desde } }).sort({ data: -1 }).lean()).filter((e) => e.presencas.length);
  const pcts = encontros.map(pctDe);
  const media = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const recentes = media(pcts.slice(0, 4));
  const anteriores = media(pcts.slice(4, 8));
  const melhor = encontros.reduce((best, e) => (!best || pctDe(e) > pctDe(best) ? e : best), null);
  const stats = await statsDoGrupo(grupo);
  const emCuidado = await CareAlert.countDocuments({ personId: { $in: grupo.membros.map((m) => m.personId) }, status: { $in: ['aberto', 'em_contato'] } });
  const ultimo = encontros[0];
  return templates.metricasGrupo({
    grupo: grupo.nome,
    membros: grupo.membros.length,
    comCelular: grupo.membros.filter((m) => m.celular).length,
    encontros: encontros.length,
    media: media(pcts),
    ultimo: ultimo && { data: formatBr(ultimo.data), pct: pctDe(ultimo), presentes: ultimo.presencas.filter((p) => p.presente).length, total: ultimo.presencas.length },
    tendencia: recentes != null && anteriores != null ? recentes - anteriores : null,
    melhor: melhor && { data: formatBr(melhor.data), pct: pctDe(melhor) },
    criticos: stats.filter((s) => s.faltasConsecutivas >= 3).length,
    emCuidado,
  });
};

// ── Cuidado: quem está faltando → ações ─────────────────────────────────
const quemEstaFaltando = async (ctx) => {
  const ov = await engagement.overview({ congregacao: ctx.actor.congregacao || ctx.actor.congregacoes });
  const porPessoa = new Map();
  ov.emRisco.filter((s) => s.faltasConsecutivas >= 2).forEach((s) => {
    const id = String(s.personId);
    const atual = porPessoa.get(id) || { personId: id, nome: s.nome, congregacao: s.congregacao, nivel: s.nivel, score: 0, onde: [], status: null };
    atual.onde.push(`${s.classe}: ${s.faltasConsecutivas} faltas`);
    atual.score = Math.max(atual.score, s.score || 0);
    if (['critico'].includes(s.nivel) || (s.nivel === 'risco' && atual.nivel === 'atencao')) atual.nivel = s.nivel;
    if (s.alerta?.status) atual.status = s.alerta.status === 'em_contato' ? 'em contato' : 'alerta aberto';
    porPessoa.set(id, atual);
  });
  const lista = [...porPessoa.values()].sort((a, b) => b.score - a.score).slice(0, 20);
  // 📉 Esfriando: caiu a frequência, ainda sem faltas seguidas (o cuidado chega antes).
  (ov.esfriando || []).forEach((s) => {
    const id = String(s.personId);
    if (lista.length >= 25 || lista.some((p) => p.personId === id)) return;
    lista.push({ personId: id, nome: s.nome, congregacao: s.congregacao, nivel: 'esfriando', score: 0, onde: [`${s.classe}: caiu de ${s.taxaAnterior}% para ${s.taxaRecente}%`], status: s.alerta?.status ? 'em contato' : null });
  });
  ctx.conversation.state = {
    tipo: 'faltando_lista', ids: lista.map((p) => p.personId), onde: Object.fromEntries(lista.map((p) => [p.personId, p.onde])),
    contexto: 'O líder está vendo a lista de quem está faltando.',
  };
  if (!lista.length) ctx.conversation.state = null;
  return templates.faltandoLista(lista);
};

const abrirCuidado = async (pessoaId, onde, ctx) => {
  const person = await Person.findOne(scopeFilter(ctx.actor, { _id: pessoaId })).select('nome celular congregacao').lean();
  if (!person) return 'Não encontrei essa pessoa. Digite *menu* para recomeçar.';
  const alerta = await CareAlert.findOne({ personId: person._id, status: { $in: ['aberto', 'em_contato'] } }).lean();
  const ultima = alerta?.acoes?.length ? alerta.acoes[alerta.acoes.length - 1] : null;
  const dados = { pessoaId: String(person._id), nome: person.nome, celular: person.celular ? formatPhone(person.celular) : null, congregacao: person.congregacao, onde: onde || [] };
  ctx.conversation.state = { tipo: 'cuidado', ...dados, contexto: `O líder está cuidando de ${person.nome} (id ${person._id}).` };
  return templates.cuidadoAcoes({ ...dados, ultimaAcao: ultima ? `${ultima.tipo.replace('_', ' ')} em ${formatBr(ultima.em || ultima.data || alerta.updatedAt)}${ultima.por ? ` por ${ultima.por}` : ''}` : null });
};

const registrarCuidado = async (st, tipo, descricao, ctx) => {
  await runTool('registrar_cuidado', { pessoaId: st.pessoaId, tipo, descricao: descricao || undefined }, ctx);
};

const ACAO_LABEL = { ligacao: 'Ligação', visita: 'Visita', oracao: 'Oração' };

// Obreiros para encaminhar: liderança da igreja, líderes de EBD e de grupos (com celular), sem o próprio líder.
const obreirosPara = (congregacao, actor, grupos) => {
  const tenant = getTenant();
  const lista = [
    ...(tenant?.lideranca || []).map((l) => ({ nome: l.nome, celular: l.celular, papel: l.papel, congregacao: l.congregacao })),
    ...(tenant?.ebdLideres || []).map((l) => ({ nome: l.nome, celular: l.celular, papel: `EBD ${l.classe}`, congregacao: l.congregacao })),
    ...grupos.flatMap((g) => g.lideres.map((l) => ({ nome: l.nome, celular: l.celular, papel: `Líder ${g.nome}`, congregacao: g.congregacao }))),
  ].filter((o) => o.nome && o.celular && !String(o.celular).includes('@') && !samePhone(o.celular, actor.telefone))
    .filter((o) => !o.congregacao || !congregacao || o.congregacao === congregacao);
  const vistos = new Set();
  return lista.filter((o) => {
    const k = String(o.celular).replace(/\D/g, '').slice(-8);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).slice(0, 15);
};

const encaminhar = async (st, obreiro, ctx) => {
  const texto = templates.encaminhamentoObreiro({ obreiro: obreiro.nome, de: ctx.actor.nome || 'A liderança', pessoa: st });
  await whatsapp.sendText(obreiro.celular, texto);
  await registrarCuidado(st, 'outro', `Encaminhado a ${obreiro.nome}${obreiro.papel ? ` (${obreiro.papel})` : ''} por ${ctx.actor.nome || 'líder'}`, ctx);
  ctx.conversation.state = null;
  return templates.encaminhado(st.nome, obreiro.nome);
};

// ── Aviso para um grupo: grupo → mensagem → prévia → envio ───────────────
const pedirAviso = (grupo, ctx) => {
  ctx.conversation.state = { tipo: 'aviso_mensagem', grupoId: String(grupo._id), grupoNome: grupo.nome };
  return templates.avisoPedirMensagem(grupo.nome, grupo.membros.filter((m) => m.celular).length);
};

const previaAviso = async (st, mensagem, ctx) => {
  const r = await runTool('enviar_aviso_grupo', { grupo: st.grupoId, mensagem, confirmado: false }, ctx);
  const n = Number(String(r.confirmar || '').match(/\d+/)?.[0]) || 0;
  ctx.conversation.state = { tipo: 'aviso_previa', grupoId: st.grupoId, grupoNome: st.grupoNome, mensagem, destinatarios: n };
  return templates.avisoPrevia(st.grupoNome, r.previa, n);
};

// ── Aniversariantes (nascimento, casamento, batismo) ─────────────────────
const datasNoPeriodo = async (campo, periodo, actor, comAnos) => {
  const now = zonedParts(timezone());
  const match = periodo === 'mes'
    ? { m: now.month }
    : { $or: Array.from({ length: 7 }, (_, i) => { const [, mm, dd] = addDaysIso(now.isoDate, i).split('-').map(Number); return { d: dd, m: mm }; }) };
  const rows = await Person.aggregate([
    { $match: scopeFilter(actor, { status: 'ativo', [campo]: { $ne: null } }) },
    { $addFields: { d: { $dayOfMonth: `$${campo}` }, m: { $month: `$${campo}` }, y: { $year: `$${campo}` } } },
    { $match: match },
    { $sort: { m: 1, d: 1, nome: 1 } },
    { $project: { nome: 1, congregacao: 1, d: 1, m: 1, y: 1 } },
  ]);
  return rows
    .map((r) => ({ ...r, anos: now.year - r.y }))
    .filter((r) => !comAnos || r.anos >= 1)
    .map((r) => `${String(r.d).padStart(2, '0')}/${String(r.m).padStart(2, '0')}: ${r.nome}${comAnos ? ` (${r.anos} ${r.anos === 1 ? 'ano' : 'anos'})` : ''}${r.congregacao ? ` · ${r.congregacao}` : ''}`);
};

const aniversariantes = async (periodo, ctx) => {
  const [niver, casamento, batismo] = await Promise.all([
    datasNoPeriodo('dataNascimento', periodo, ctx.actor, false),
    datasNoPeriodo('dataCasamento', periodo, ctx.actor, true),
    datasNoPeriodo('dataBatismo', periodo, ctx.actor, true),
  ]);
  ctx.conversation.state = { tipo: 'aniversariantes_menu' };
  return templates.aniversariantesLista({ titulo: periodo === 'mes' ? 'do mês' : 'da semana', niver, casamento, batismo });
};

// ── Relatório da semana com avaliação ────────────────────────────────────
const relatorioSemana = async (ctx) => {
  const r = await runTool('resumo_frequencia', {}, ctx);
  const ov = await engagement.overview({ congregacao: ctx.actor.congregacao || ctx.actor.congregacoes });
  const esfriando = [...new Set((ov.esfriando || []).map((s) => s.nome))];
  const pct = (p, t) => (t ? Math.round((p / t) * 100) : 0);
  const ebdItens = r.classes.filter((c) => c.total).map((c) => ({
    nome: `${c.classe}`, detalhe: c.congregacao, presentes: c.presentes, total: c.total, pct: pct(c.presentes, c.total), tema: c.tema, ausentes: c.ausentes,
  }));
  const encItens = r.encontrosDaSemana.filter((e) => e.total).map((e) => ({
    nome: e.grupo, detalhe: `${atividadeLabel(e.atividade)} · ${e.data}`, presentes: e.presentes, total: e.total, pct: pct(e.presentes, e.total), tema: e.tema, ausentes: e.ausentes,
  }));
  const todos = [...ebdItens, ...encItens].filter((i) => i.total >= 3);
  const melhor = todos.filter((i) => i.pct >= 90).sort((a, b) => b.pct - a.pct || b.total - a.total)[0];
  const pior = todos.filter((i) => i.pct < 50).sort((a, b) => a.pct - b.pct)[0];
  ctx.conversation.state = { tipo: 'contexto', contexto: 'O líder acabou de ver o relatório da semana.' };
  return templates.relatorioSemana({
    data: formatBr(new Date(`${r.data}T12:00:00Z`)),
    ebd: ebdItens,
    encontros: encItens,
    destaque: melhor && `*${melhor.nome}* (${melhor.detalhe}) com ${melhor.pct}% de presença (${melhor.presentes}/${melhor.total}). Que bênção! Vale parabenizar o grupo no próximo culto. 🙌`,
    esfriando,
    alerta: pior && `*${pior.nome}* (${pior.detalhe}) teve só ${pior.presentes} de ${pior.total} (${pior.pct}%). *Isso preocupa:* ore e procure os ausentes esta semana.`,
  });
};

// ── Pedidos de oração ────────────────────────────────────────────────────
const menuOracao = async (ctx) => {
  const novos = await PedidoOracao.countDocuments(scopeFilter(ctx.actor, { status: 'novo', createdAt: { $gte: new Date(Date.now() - 30 * 864e5) } }));
  ctx.conversation.state = { tipo: 'oracao_menu' };
  return templates.oracaoMenu(novos);
};

const listarOracoes = async (dias, ctx) => {
  const pedidos = await prayer.listarPedidos({ filtroCongregacao: scopeFilter(ctx.actor, {}), dias, limite: 30 });
  ctx.conversation.state = { tipo: 'oracao_lista', ids: pedidos.map((p) => String(p._id)), dias };
  return templates.oracaoLista(pedidos.map((p) => ({ nome: p.nome, congregacao: p.congregacao, status: p.status, texto: p.texto, data: formatBr(p.createdAt) })), dias);
};


// ── Culto: check-in por QR Code ──────────────────────────────────────────
const abrirCultoLider = async (congregacao, ctx) => {
  const { culto, criado } = await cultoSvc.abrirCulto({ congregacao, userId: ctx.actor.userId, userNome: ctx.actor.nome });
  const qr = await cultoSvc.qrDataUrl(culto, 900);
  if (ctx.actor.telefone) {
    await whatsapp.sendImage(ctx.actor.telefone, qr, templates.checkinQrLegenda(culto.titulo, culto.codigo))
      .catch((err) => console.warn('[CULTO] Falha ao enviar QR ao líder:', err.message));
    // Convite pronto para encaminhar nos grupos
    await whatsapp.sendText(ctx.actor.telefone, cultoSvc.conviteCheckin(culto))
      .catch((err) => console.warn('[CULTO] Falha ao enviar o convite ao líder:', err.message));
  }
  // Demais líderes recebem pela fila (quem abriu já recebeu acima)
  if (criado) cultoSvc.avisarLideranca(culto, { excluir: [ctx.actor.telefone].filter(Boolean) }).catch((err) => console.warn('[CULTO] Falha ao avisar a liderança:', err.message));
  ctx.conversation.state = { tipo: 'culto_menu', cultoId: String(culto._id) };
  return templates.cultoLider(cultoSvc.resumo(culto));
};

const iniciarCulto = (ctx) => {
  const congs = congregacoesDo(ctx.actor);
  if (congs.length === 1) return abrirCultoLider(congs[0], ctx);
  ctx.conversation.state = { tipo: 'culto_congregacao', congs };
  return templates.opcoesNumeradas('⛪ *Culto de hoje*\nEm qual congregação?', congs);
};

// ── Jornada do visitante / novo convertido ───────────────────────────────
const listarJornada = async (ctx) => {
  if (!hasFeature(getTenant(), 'jornadaVisitante')) return 'A jornada de 30 dias do visitante está disponível a partir do plano *Crescer*. 🙏';
  const lista = (await jornadaSvc.listarJornadas({ filtro: scopeFilter(ctx.actor, {}) })).slice(0, 25);
  ctx.conversation.state = {
    tipo: 'faltando_lista',
    ids: lista.map((j) => String(j.personId)),
    onde: Object.fromEntries(lista.map((j) => [String(j.personId), [`${j.tipo} · jornada dia ${j.dia}/30${j.retornou ? ' · voltou' : ' · ainda não voltou'}`]])),
    contexto: 'O líder está vendo a lista de visitantes e novos convertidos em jornada.',
  };
  if (!lista.length) ctx.conversation.state = null;
  return templates.jornadaLista(lista.map((j) => ({ nome: j.nome, tipo: j.tipo, dia: j.dia, retornou: j.retornou, onde: j.retornouOnde, respondeu: Boolean(j.respondeuEm) })));
};

// ── Escalas de voluntários ───────────────────────────────────────────────
const listarEscalas = async (ctx) => {
  const escalas = await escalaSvc.proximasEscalas(scopeFilter(ctx.actor, {}));
  ctx.conversation.state = { tipo: 'escalas_lista', ids: escalas.map((e) => String(e._id)) };
  if (!escalas.length) ctx.conversation.state = null;
  return templates.escalasLider(escalas.map(escalaSvc.resumoEscala));
};

const detalheEscala = async (escalaId, ctx) => {
  const e = await Escala.findOne(scopeFilter(ctx.actor, { _id: escalaId })).lean();
  if (!e) return 'Não encontrei essa escala. Digite *menu* para recomeçar.';
  ctx.conversation.state = { tipo: 'escala_detalhe', escalaId: String(e._id) };
  return templates.escalaDetalhe(escalaSvc.resumoEscala(e));
};


// ── Resumo do sermão (campanha para a igreja) ────────────────────────────
const SERMAO_MAX_AUDIO_SEG = 320; // 5 min + tolerância
const iniciarSermao = (ctx) => {
  const congs = congregacoesDo(ctx.actor);
  if (congs.length === 1) return pedirSermao(congs[0], ctx);
  const opcoes = [...(ctx.actor.congregacao || ctx.actor.congregacoes ? [] : ['Todas as congregações']), ...congs];
  ctx.conversation.state = { tipo: 'sermao_publico', opcoes };
  return templates.sermaoPublico(opcoes);
};
const pedirSermao = (congregacao, ctx) => {
  ctx.conversation.state = { tipo: 'sermao_relato', congregacao: congregacao === 'Todas as congregações' ? null : congregacao };
  return templates.sermaoPedirRelato(congregacao || 'toda a igreja');
};
const publicoSermao = (st, ctx) => ({
  congregacao: st.congregacao || undefined,
  congregacoes: st.congregacao ? undefined : (ctx.actor.congregacoes || undefined),
  tipos: sermaoSvc.PUBLICO_TIPOS,
});
const previaSermao = async (st, relato, ctx) => {
  const texto = await sermaoSvc.organizarSermao(relato, { pregador: ctx.actor.nome, data: formatBr(new Date()) });
  const publico = await campanhaSvc.montarPublico(publicoSermao(st, ctx));
  const n = publico.filter((d) => d.status === 'pendente').length;
  ctx.conversation.state = { tipo: 'sermao_previa', congregacao: st.congregacao, texto, relato: relato.slice(0, 6000), n };
  return templates.sermaoPrevia(texto, n, Math.max(1, Math.ceil(n / 350)));
};
const agendarSermao = async (st, quando, ctx) => {
  const agora = zonedParts(timezone());
  const enviarApos = quando === 'amanha' ? new Date(`${addDaysIso(agora.isoDate, 1)}T09:00:00`) : new Date(Date.now() + 3600e3);
  const c = await campanhaSvc.criar({
    tipo: 'sermao', titulo: `Sermão ${formatBr(new Date())}`, texto: templates.sermaoMembro(st.texto),
    publico: { ...publicoSermao(st, ctx), descricao: st.congregacao || 'toda a igreja' },
    enviarApos, user: { _id: ctx.actor.userId, nome: ctx.actor.nome }, avisarCelular: ctx.actor.telefone,
  });
  ctx.conversation.state = null;
  const r = campanhaSvc.resumo(c);
  return templates.sermaoAgendado(r.pendentes, quando === 'amanha' ? 'amanhã a partir das 9h' : 'daqui a 1 hora');
};


// ── Eventos (inscrições pelo WhatsApp) ───────────────────────────────────
const listarEventos = async (ctx) => {
  const eventos = await Evento.find(scopeFilter(ctx.actor, { cancelado: { $ne: true }, data: { $gte: new Date(Date.now() - 864e5) } })).sort({ data: 1 }).limit(15);
  ctx.conversation.state = { tipo: 'eventos_lista', ids: eventos.map((e) => String(e._id)) };
  if (!eventos.length) ctx.conversation.state = null;
  return templates.eventosLider(eventos.map(eventoSvc.resumo));
};
const detalheEvento = async (id, ctx) => {
  const e = await Evento.findOne(scopeFilter(ctx.actor, { _id: id }));
  if (!e) return 'Não encontrei esse evento. Digite *menu* para recomeçar.';
  ctx.conversation.state = { tipo: 'evento_detalhe', eventoId: String(e._id) };
  return templates.eventoDetalheLider(eventoSvc.resumo(e), e.inscricoes.filter((i) => i.status !== 'cancelado'));
};
const divulgarEvento = async (eventoId, ctx) => {
  const e = await Evento.findOne(scopeFilter(ctx.actor, { _id: eventoId }));
  if (!e) return null;
  const c = await campanhaSvc.criar({
    tipo: 'evento', titulo: `Divulgação: ${e.titulo}`, texto: templates.eventoDivulgacao(eventoSvc.resumo(e)), eventoId: e._id,
    publico: { congregacao: e.congregacao || ctx.actor.congregacao || undefined, congregacoes: e.congregacao ? undefined : ctx.actor.congregacoes, tipos: sermaoSvc.PUBLICO_TIPOS, descricao: e.congregacao || 'toda a igreja' },
    user: { _id: ctx.actor.userId, nome: ctx.actor.nome }, avisarCelular: ctx.actor.telefone,
  });
  ctx.conversation.state = null;
  return templates.eventoDivulgacaoAgendada(campanhaSvc.resumo(c).pendentes);
};

// ── Impacto do mês ───────────────────────────────────────────────────────
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const impactoDoMes = async (ctx) => {
  const r = await impactoSvc.calcular(undefined, scopeFilter(ctx.actor, {}));
  const [y, m] = r.mes.split('-');
  ctx.conversation.state = { tipo: 'contexto', contexto: 'O líder acabou de ver o impacto do mês.' };
  return templates.impactoMes(r, `${MESES[Number(m) - 1]}/${y} (até hoje)`, getTenant()?.nomeCurto);
};

// ── Menu principal ───────────────────────────────────────────────────────
const opcaoMenu = async (n, ctx) => {
  ctx.conversation.state = null;
  if (n === 1) {
    ctx.conversation.state = { tipo: 'pesquisa' };
    return templates.pesquisarPessoaPergunta();
  }
  if (n === 4) {
    ctx.conversation.state = { tipo: 'presenca_tipo' };
    return templates.presencaTipo();
  }
  if (n === 5) return escolherGrupo(ctx, { proximo: 'resumo', titulo: '📝 *Resumir encontro*\nDe qual grupo?' });
  if (n === 6) return escolherGrupo(ctx, { proximo: 'cuidado', titulo: '🏷️ *Grupos*\nQual grupo você quer acompanhar?' });
  if (n === 7) return quemEstaFaltando(ctx);
  if (n === 8) return escolherGrupo(ctx, { proximo: 'aviso', titulo: '📣 *Enviar aviso*\nPara qual grupo?' });
  if (n === 9) {
    ctx.conversation.state = { tipo: 'aniversariantes_menu' };
    return templates.aniversariantesMenu();
  }
  if (n === 10) return relatorioSemana(ctx);
  if (n === 11) return menuOracao(ctx);
  if (n === 12) return listarJornada(ctx);
  if (n === 13) return listarEscalas(ctx);
  if (n === 14) return iniciarSermao(ctx);
  if (n === 15) return listarEventos(ctx);
  if (n === 16) return impactoDoMes(ctx);
  if (PEDIDOS[n]) return { agente: PEDIDOS[n] };
  return null;
};

const PEDIDOS_FICHA = {
  1: (st) => `Quero editar os dados de ${st.nome} (id ${st.pessoaId}). Pergunte o que devo alterar.`,
  2: (st) => `Quero registrar uma ação de cuidado para ${st.nome} (id ${st.pessoaId}). Pergunte o que foi feito (ligação, visita, oração) e como foi.`,
  3: (st) => `Quero enviar uma mensagem de WhatsApp para ${st.nome} (id ${st.pessoaId}). Pergunte o texto, mostre a prévia e peça confirmação.`,
};

/**
 * Entrada: { text (sem prefixo de transcrição), media, audioSegundos, actor, conversation }.
 */
// eslint-disable-next-line no-use-before-define
const handleFlow = async (input) => {
  const antes = input.conversation.state;
  try {
    return await step(input);
  } catch (err) {
    if (!err.toolError) throw err;
    // Erro de negócio (classe vazia, chamada bloqueada…): explica e mantém o passo anterior.
    input.conversation.state = antes;
    return `⚠️ ${err.message}\n\n_Escolha outra opção ou digite *menu*._`;
  }
};

const step = async ({ text, media, audioSegundos, actor, conversation }) => {
  const ctx = { actor, conversation, channel: 'whatsapp' };
  const st = conversation.state;
  if (!st) return null;
  const n = parseChoice(text);

  // Foto enviada com uma ficha aberta → atualiza a foto do cadastro.
  if (media?.kind === 'image' && ['ficha', 'foto_pessoa'].includes(st.tipo)) return atualizarFoto(st, media, ctx);

  switch (st.tipo) {
    case 'menu':
      return n ? opcaoMenu(n, ctx) : null;

    case 'pesquisa':
      return text ? pesquisar(text, ctx) : null;
    case 'pesquisa_escolha': {
      const id = pick(st.ids, n);
      if (!id) return n ? 'Número fora da lista. Responda com um dos números acima.' : pesquisar(text, ctx);
      const person = await Person.findOne(scopeFilter(actor, { _id: id })).lean();
      return person ? mostrarFicha(person, ctx) : templates.pesquisaSemResultado(text);
    }
    case 'ficha':
      if (n === 4) {
        conversation.state = { ...st, tipo: 'foto_pessoa' };
        return templates.pedirFotoPessoa(st.nome);
      }
      if (PEDIDOS_FICHA[n]) {
        conversation.state = { tipo: 'contexto', contexto: st.contexto };
        return { agente: PEDIDOS_FICHA[n](st) };
      }
      return null;
    case 'foto_pessoa':
      return text ? null : templates.pedirFotoPessoa(st.nome);

    case 'presenca_tipo':
      if (n === 1) return iniciarEbd(ctx);
      if (n === 2) return escolherGrupo(ctx, { proximo: 'grupo_menu', titulo: '🏷️ *Uniões e grupos*\nQual grupo?' });
      if (n === 3) return iniciarCulto(ctx);
      return null;
    case 'presenca_congregacao': {
      const cong = pick(st.congs, n);
      return cong ? escolherClasseEbd(cong, ctx) : null;
    }
    case 'presenca_classe': {
      const classe = pick(ebd.CLASSES, n);
      return classe ? abrirChamadaEbd(classe, st.congregacao, ctx) : null;
    }

    case 'grupo_congregacao': {
      const cong = pick(st.congs, n);
      return cong ? escolherGrupo(ctx, { proximo: st.proximo, titulo: st.titulo, congregacao: cong }) : null;
    }
    case 'grupo_escolha': {
      const id = pick(st.ids, n);
      return id ? seguirComGrupo(id, st.proximo, ctx) : null;
    }
    case 'grupo_menu': {
      const grupo = await carregarGrupo(st.grupoId, ctx);
      if (!grupo) return null;
      if (n === 1) return escolherAtividade(grupo, ctx);
      if (n === 2) return listarEncontros(grupo, ctx);
      if (n === 3) return escolherEncontroParaResumo(grupo, ctx);
      return null;
    }
    case 'grupo_atividade': {
      const atividade = pick(ATIVIDADES_MENU, n);
      const grupo = atividade && await carregarGrupo(st.grupoId, ctx);
      return grupo ? abrirChamadaEncontro(grupo, { atividade, data: hoje() }, ctx) : null;
    }
    case 'encontros_lista': {
      const id = pick(st.ids, n);
      return id ? detalheEncontro(id, ctx) : null;
    }
    case 'encontro_detalhe':
      if (n === 1) return corrigirPresenca(st.encontroId, ctx);
      if (n === 2) return pedirRelato(await Encontro.findById(st.encontroId).lean(), ctx);
      if (/cancelar\s+(o\s+)?resumo/i.test(text)) return cancelarResumo(st.encontroId, ctx);
      return null;

    case 'resumo_encontro': {
      const id = pick(st.ids, n);
      return id ? pedirRelato(await Encontro.findById(id).lean(), ctx) : null;
    }
    case 'resumo_relato':
      if (audioSegundos && audioSegundos > RESUMO_MAX_AUDIO_SEG) return templates.resumoAudioLongo(audioSegundos);
      if (!text || text.length < 15) return 'Conte um pouco mais sobre o encontro (texto ou áudio de até 2 minutos). 🙏';
      return receberRelato(st, text, ctx);
    case 'resumo_previa':
      if (n === 1) return agendarResumo(st, ctx);
      if (n === 2) {
        conversation.state = { tipo: 'resumo_relato', encontroId: st.encontroId };
        return 'Ok! Mande o novo relato por texto ou áudio (até 2 minutos).';
      }
      if (n === 3) {
        conversation.state = null;
        return 'Resumo descartado. Nada foi enviado. 👍';
      }
      if (audioSegundos && audioSegundos > RESUMO_MAX_AUDIO_SEG) return templates.resumoAudioLongo(audioSegundos);
      return text && text.length >= 15 ? receberRelato(st, text, ctx) : null; // novo relato = refazer

    case 'grupo_cuidado': {
      const grupo = await carregarGrupo(st.grupoId, ctx);
      if (!grupo) return null;
      if (n === 1) return verMembrosGrupo(grupo, ctx);
      if (n === 2) { conversation.state = { tipo: 'grupo_cuidado', grupoId: st.grupoId }; return frequenciaGrupo(grupo); }
      if (n === 3) return ausentesGrupo(grupo, ctx);
      if (n === 4) { conversation.state = { tipo: 'grupo_cuidado', grupoId: st.grupoId }; return metricasGrupo(grupo); }
      return null;
    }

    case 'faltando_lista': {
      const id = pick(st.ids, n);
      return id ? abrirCuidado(id, st.onde?.[id], ctx) : null;
    }
    case 'cuidado':
      if (n === 1) { conversation.state = { ...st, tipo: 'cuidado_ligacao' }; return templates.ligacaoPergunta(st.nome, st.celular); }
      if (n === 2) { conversation.state = { ...st, tipo: 'cuidado_visita' }; return templates.visitaPergunta(st.nome); }
      if (n === 3) { conversation.state = { ...st, tipo: 'cuidado_oracao' }; return templates.oracaoPergunta(st.nome); }
      if (n === 4) {
        conversation.state = { tipo: 'contexto', contexto: st.contexto };
        return { agente: `Quero enviar uma mensagem de WhatsApp de cuidado para ${st.nome} (id ${st.pessoaId}), que está faltando (${(st.onde || []).join('; ')}). Sugira um texto acolhedor, mostre a prévia e peça confirmação antes de enviar.` };
      }
      if (n === 5) {
        const obreiros = obreirosPara(st.congregacao, actor, await gruposAcessiveis(actor));
        if (!obreiros.length) return templates.semObreiros();
        conversation.state = { ...st, tipo: 'cuidado_encaminhar', obreiros };
        return templates.obreirosLista(st.nome, obreiros);
      }
      return null;
    case 'cuidado_ligacao':
      if (n === 1) { conversation.state = { ...st, tipo: 'cuidado_relato', acao: 'ligacao' }; return templates.cuidadoComoFoi('ligacao', st.nome); }
      if (n === 2) {
        await registrarCuidado(st, 'ligacao', 'Tentativa de ligação sem sucesso', ctx);
        conversation.state = { ...st, tipo: 'cuidado_pos_tentativa' };
        return templates.ligacaoNaoAtendeu(st.nome);
      }
      return null;
    case 'cuidado_pos_tentativa':
      if (n === 1) { conversation.state = { ...st, tipo: 'cuidado' }; return step({ text: '4', actor, conversation }); }
      if (n === 2) { conversation.state = { ...st, tipo: 'cuidado' }; return step({ text: '5', actor, conversation }); }
      if (n === 3) return quemEstaFaltando(ctx);
      return null;
    case 'cuidado_visita':
      if (n === 1) { conversation.state = { ...st, tipo: 'cuidado_relato', acao: 'visita' }; return templates.cuidadoComoFoi('visita', st.nome); }
      if (n === 2) { conversation.state = { ...st, tipo: 'cuidado_agendar' }; return templates.visitaAgendar(st.nome); }
      return null;
    case 'cuidado_agendar':
      if (!text) return templates.visitaAgendar(st.nome);
      await registrarCuidado(st, 'outro', `Visita agendada: ${text}`, ctx);
      conversation.state = null;
      return templates.cuidadoRegistrado('Agendamento de visita', st.nome);
    case 'cuidado_oracao':
      if (n === 1) {
        await registrarCuidado(st, 'oracao', 'Orou pela pessoa', ctx);
        conversation.state = null;
        return templates.cuidadoRegistrado('Oração', st.nome);
      }
      if (n === 2) return abrirCuidado(st.pessoaId, st.onde, ctx);
      return null;
    case 'cuidado_relato': {
      if (!text) return templates.cuidadoComoFoi(st.acao, st.nome);
      const descricao = text.trim() === '0' ? '' : text.trim();
      await registrarCuidado(st, st.acao, descricao, ctx);
      conversation.state = null;
      return templates.cuidadoRegistrado(ACAO_LABEL[st.acao] || 'Cuidado', st.nome);
    }
    case 'cuidado_encaminhar': {
      const obreiro = pick(st.obreiros, n);
      return obreiro ? encaminhar(st, obreiro, ctx) : null;
    }

    case 'aviso_mensagem':
      if (!text || text.length < 3) return 'Qual é a mensagem do aviso? Pode escrever ou mandar um áudio.';
      return previaAviso(st, text, ctx);
    case 'aviso_previa':
      if (n === 1) {
        await runTool('enviar_aviso_grupo', { grupo: st.grupoId, mensagem: st.mensagem, confirmado: true }, ctx);
        conversation.state = null;
        return templates.avisoEnviando(st.destinatarios, st.grupoNome);
      }
      if (n === 2) { conversation.state = { tipo: 'aviso_mensagem', grupoId: st.grupoId, grupoNome: st.grupoNome }; return 'Ok! Mande a nova mensagem (texto ou áudio).'; }
      if (n === 3) { conversation.state = null; return 'Aviso cancelado. Nada foi enviado. 👍'; }
      return text && text.length >= 3 ? previaAviso(st, text, ctx) : null;

    case 'aniversariantes_menu':
      if (n === 1) return aniversariantes('semana', ctx);
      if (n === 2) return aniversariantes('mes', ctx);
      return null;

    case 'oracao_menu':
      if (n === 1) { conversation.state = { tipo: 'oracao_texto' }; return templates.oracaoPedirTexto(); }
      if (n === 2) return listarOracoes(7, ctx);
      return null;
    case 'oracao_texto':
      if (!text || text.length < 3) return templates.oracaoPedirTexto();
      conversation.state = { tipo: 'oracao_conf', texto: text.trim() };
      return templates.oracaoPerguntaConfidencial();
    case 'oracao_conf': {
      if (n !== 1 && n !== 2) return templates.oracaoPerguntaConfidencial();
      const { texto: textoPedido } = st;
      if (await prayer.pedidoRecente({ userId: actor.userId, personId: actor.personId, nome: actor.nome })) {
        conversation.state = null;
        return 'Você já fez um pedido na última hora. A liderança já está orando. 🙏';
      }
      await prayer.registrarPedido({ nome: actor.nome, personId: actor.personId, userId: actor.userId, celular: actor.telefone, congregacao: actor.congregacao || '', texto: textoPedido, origem: 'whatsapp', enviadoPor: actor.userId, confidencial: n === 2 });
      conversation.state = null;
      return templates.oracaoRegistrada();
    }
    case 'oracao_lista':
      if (n === 1 && st.ids?.length) {
        const r = await PedidoOracao.updateMany({ _id: { $in: st.ids }, status: 'novo' }, { $set: { status: 'orado', oradoEm: new Date(), oradoPor: actor.nome } });
        conversation.state = null;
        return templates.oracaoMarcados(r.modifiedCount);
      }
      if (n === 2) return listarOracoes(30, ctx);
      return null;

    case 'culto_congregacao': {
      const cong = pick(st.congs, n);
      return cong ? abrirCultoLider(cong, ctx) : null;
    }
    case 'culto_menu': {
      const c = await Culto.findById(st.cultoId).lean();
      if (!c) return null;
      if (n === 1) return templates.cultoPresentes(c.titulo, c.presencas);
      if (n === 2) {
        await cultoSvc.encerrar(c._id);
        conversation.state = null;
        return templates.cultoEncerrado(c.titulo, c.presencas.length);
      }
      return null;
    }

    case 'escalas_lista': {
      const id = pick(st.ids, n);
      return id ? detalheEscala(id, ctx) : null;
    }
    case 'escala_detalhe':
      if (n === 1) {
        const enviados = await escalaSvc.enviarConvites(st.escalaId);
        return templates.escalaReenviado(enviados);
      }
      return null;
    case 'escala_substituto': {
      const sug = pick(st.sugestoes || [], n);
      if (!sug) return null;
      const r = await escalaSvc.convidarSubstituto({ escalaId: st.escalaId, itemId: st.itemId, personId: sug.id });
      conversation.state = null;
      return templates.escalaSubstitutoConvidado(r.nome, r.funcao);
    }

    case 'sermao_publico': {
      const op = pick(st.opcoes, n);
      return op ? pedirSermao(op, ctx) : null;
    }
    case 'sermao_relato':
      if (audioSegundos && audioSegundos > SERMAO_MAX_AUDIO_SEG) return templates.sermaoAudioLongo(audioSegundos);
      if (!text || text.length < 30) return 'Conte um pouco mais do sermão (texto ou áudio de até 5 minutos). 🙏';
      return previaSermao(st, text, ctx);
    case 'sermao_previa':
      if (n === 1) return agendarSermao(st, 'amanha', ctx);
      if (n === 2) return agendarSermao(st, '1h', ctx);
      if (n === 3) { conversation.state = { tipo: 'sermao_relato', congregacao: st.congregacao }; return 'Ok! Mande o novo relato do sermão (texto ou áudio).'; }
      if (n === 4) { conversation.state = null; return 'Resumo do sermão descartado. Nada foi enviado. 👍'; }
      if (audioSegundos && audioSegundos > SERMAO_MAX_AUDIO_SEG) return templates.sermaoAudioLongo(audioSegundos);
      return text && text.length >= 30 ? previaSermao(st, text, ctx) : null;

    case 'eventos_lista': {
      const id = pick(st.ids, n);
      return id ? detalheEvento(id, ctx) : null;
    }
    case 'evento_detalhe':
      if (n === 1) return divulgarEvento(st.eventoId, ctx);
      return null;
    default:
      return null;
  }
};

module.exports = { handleFlow, parseChoice, PEDIDOS, RESUMO_DELAY_MS };
