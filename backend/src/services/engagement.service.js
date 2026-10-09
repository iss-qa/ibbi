const EbdAula = require('../models/EbdAula.model');
const Encontro = require('../models/Encontro.model');
const GrupoEncontro = require('../models/GrupoEncontro.model');
const Person = require('../models/Person.model');
const CareAlert = require('../models/CareAlert.model');
const Conversation = require('../models/Conversation.model');
const AutomationRun = require('../models/AutomationRun.model');
const whatsapp = require('./whatsapp.service');
const { sendEmail } = require('./email.service');
const { registrarComunicacao } = require('./trigger.service');
const { notifyLeadership, classLeaders } = require('./leadership.service');
const generators = require('./ai/generators');
const templates = require('../templates/messages.templates');
const { getTenant } = require('../tenancy/context');
const { churchName } = require('../tenancy/brand');
const { hasFeature } = require('../config/plans');
const { phoneVariants } = require('../utils/phone');
const { formatBr } = require('../utils/time');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const settings = () => {
  const a = getTenant()?.automacoes?.ausencia || {};
  return {
    ativo: Boolean(a.ativo),
    autoEnviar: Boolean(a.autoEnviar),
    mensagemPrimeiraFalta: a.mensagemPrimeiraFalta !== false,
    semanasAlerta: a.semanasAlerta || 4,
    enviarEmail: a.enviarEmail !== false,
  };
};

const levelFor = (faltas, semanasAlerta) => {
  if (faltas >= semanasAlerta) return 'critico';
  if (faltas >= 3) return 'risco';
  if (faltas >= 2) return 'atencao';
  return null;
};

/**
 * Histórico de frequência por pessoa nas últimas `weeks` semanas.
 * faltasConsecutivas = ausências seguidas a partir da aula mais recente em que a pessoa constava.
 */
// Streaks de presença a partir de sessões (aulas da EBD ou encontros), da mais recente para a mais antiga.
const computeStreaks = (sessions, labelOf) => {
  const map = new Map();
  for (const sessao of sessions) {
    for (const p of sessao.presencas || []) {
      if (!p.personId) continue;
      const id = String(p.personId);
      if (!map.has(id)) {
        map.set(id, {
          personId: id, nome: p.nome, classe: labelOf(sessao), congregacao: sessao.congregacao,
          registros: [], faltasConsecutivas: 0, ultimaPresenca: null, streakAberto: true,
        });
      }
      const s = map.get(id);
      s.registros.push({ data: sessao.data, presente: p.presente });
      if (p.presente) {
        if (!s.ultimaPresenca) s.ultimaPresenca = sessao.data;
        s.streakAberto = false;
      } else if (s.streakAberto) {
        s.faltasConsecutivas += 1;
      }
    }
  }

  const { semanasAlerta } = settings();
  return [...map.values()].map((s) => {
    const total = s.registros.length;
    const presentes = s.registros.filter((r) => r.presente).length;
    const recentes = s.registros.slice(0, 4);
    const anteriores = s.registros.slice(4, 8);
    const taxa = (arr) => (arr.length ? arr.filter((r) => r.presente).length / arr.length : null);
    const tr = taxa(recentes);
    const ta = taxa(anteriores);
    // Score 0-100: faltas seguidas pesam mais; queda de frequência soma.
    const score = Math.min(100, Math.round(
      s.faltasConsecutivas * (100 / Math.max(semanasAlerta, 1))
      + (tr !== null && ta !== null && ta > tr ? (ta - tr) * 30 : 0),
    ));
    const { streakAberto, registros, ...rest } = s;
    return {
      ...rest,
      totalAulas: total,
      presencas: presentes,
      taxaPresenca: total ? Math.round((presentes / total) * 100) : 0,
      tendencia: tr !== null && ta !== null ? Math.round((tr - ta) * 100) : null,
      // Esfriando: vinha bem (≥75% nos 4 anteriores) e caiu (≤50% nos 4 últimos) sem ainda
      // acumular faltas seguidas — o alerta chega antes da ausência virar distância.
      esfriando: total >= 6 && ta !== null && tr !== null && ta >= 0.75 && tr <= 0.5 && s.faltasConsecutivas < 2,
      taxaRecente: tr !== null ? Math.round(tr * 100) : null,
      taxaAnterior: ta !== null ? Math.round(ta * 100) : null,
      score,
      nivel: levelFor(s.faltasConsecutivas, semanasAlerta),
    };
  });
};

const congregacaoFilter = (congregacao) => (Array.isArray(congregacao) ? { $in: congregacao } : congregacao);

/**
 * Histórico de frequência por pessoa na EBD nas últimas `weeks` semanas.
 * faltasConsecutivas = ausências seguidas a partir da aula mais recente em que a pessoa constava.
 */
const personAttendance = async ({ congregacao, classe, weeks = 16 } = {}) => {
  const filter = { data: { $gte: new Date(Date.now() - weeks * WEEK_MS) } };
  if (congregacao) filter.congregacao = congregacaoFilter(congregacao);
  if (classe) filter.classe = classe;
  const aulas = await EbdAula.find(filter).sort({ data: -1 }).select('data classe congregacao presencas').lean();
  return computeStreaks(aulas, (a) => a.classe).map((s) => ({ ...s, origem: 'ebd' }));
};

// Mesma análise para os encontros dos grupos (uniões, louvor…), por grupo.
const encontroAttendance = async ({ congregacao, grupoId, weeks = 16, incluirEbd = false } = {}) => {
  const filter = { data: { $gte: new Date(Date.now() - weeks * WEEK_MS) } };
  if (!incluirEbd) filter.ebdAulaId = null; // aulas da EBD já são analisadas pela EBD
  if (congregacao) filter.congregacao = congregacaoFilter(congregacao);
  if (grupoId) filter.grupoId = grupoId;
  const encontros = await Encontro.find(filter).sort({ data: -1 }).select('data grupoId grupoNome congregacao presencas').lean();
  const porGrupo = new Map();
  encontros.forEach((e) => porGrupo.set(String(e.grupoId), [...(porGrupo.get(String(e.grupoId)) || []), e]));
  return [...porGrupo.entries()].flatMap(([gid, lista]) => computeStreaks(lista, (e) => e.grupoNome)
    .map((s) => ({ ...s, origem: 'encontro', grupoId: gid })));
};

const alertKey = (a) => `${a.personId}:${a.origem === 'encontro' ? `encontro:${a.grupoId}` : 'ebd'}`;

const overview = async ({ congregacao } = {}) => {
  const incluirEncontros = getTenant()?.automacoes?.ausencia?.incluirEncontros !== false;
  const [ebd, encontros, alertas] = await Promise.all([
    personAttendance({ congregacao }),
    incluirEncontros ? encontroAttendance({ congregacao }) : [],
    CareAlert.find({ status: { $in: ['aberto', 'em_contato'] }, ...(congregacao ? { congregacao: congregacaoFilter(congregacao) } : {}) })
      .sort({ faltasConsecutivas: -1 }).lean(),
  ]);
  const stats = [...ebd, ...encontros];
  const emRisco = stats.filter((s) => s.nivel).sort((a, b) => b.score - a.score);
  const alertaPor = new Map(alertas.map((a) => [alertKey(a), a]));
  return {
    totais: {
      acompanhados: new Set(stats.map((s) => s.personId)).size,
      atencao: emRisco.filter((s) => s.nivel === 'atencao').length,
      risco: emRisco.filter((s) => s.nivel === 'risco').length,
      critico: emRisco.filter((s) => s.nivel === 'critico').length,
      alertasAbertos: alertas.filter((a) => a.status === 'aberto').length,
      emContato: alertas.filter((a) => a.status === 'em_contato').length,
      esfriando: stats.filter((s) => s.esfriando).length,
      taxaMedia: stats.length ? Math.round(stats.reduce((acc, s) => acc + s.taxaPresenca, 0) / stats.length) : 0,
    },
    emRisco: emRisco.map((s) => ({ ...s, alerta: alertaPor.get(alertKey(s)) || null })),
    // Queda de frequência sem faltas seguidas (quem já está em risco fica de fora).
    esfriando: stats
      .filter((s) => s.esfriando && !emRisco.some((r) => String(r.personId) === String(s.personId)))
      .sort((a, b) => (a.tendencia ?? 0) - (b.tendencia ?? 0)),
    alertas,
  };
};

const pushAcao = (alert, acao) => {
  alert.acoes.push({ por: 'Assistente IA', ...acao });
};

// Envia a mensagem ao ausente (foto do encontro/turma + texto), com log e registro no alerta.
const sendAbsenceMessage = async ({ person, mensagem, aula, alert, faltas }) => {
  const conv = await Conversation.findOne({ canal: 'whatsapp', chave: { $in: phoneVariants(person.celular) } })
    .select('lastInboundAt').lean();
  try {
    await whatsapp.sendProactive({
      number: person.celular,
      text: mensagem,
      templateKey: 'ausencia',
      templateParams: [String(person.nome).split(' ')[0], aula?.tema || aula?.grupoNome || 'nossa EBD'],
      lastInboundAt: conv?.lastInboundAt,
    });
    if (aula?.fotoUrl) await whatsapp.sendImage(person.celular, aula.fotoUrl, '').catch(() => {});
    await registrarComunicacao({
      tipo: 'ausencia', destinatarios: [{ nome: person.nome, celular: person.celular, status: 'concluido' }],
      conteudo: mensagem, status: 'concluido', origemNome: person.nome, origemCongregacao: aula?.congregacao,
    });
    if (alert) {
      alert.mensagemEnviadaEm = new Date();
      alert.mensagemSugerida = undefined;
      if (alert.status === 'aberto') alert.status = 'em_contato';
      pushAcao(alert, { tipo: 'mensagem_ia', canal: 'whatsapp', descricao: mensagem });
      await alert.save();
    }
    return true;
  } catch (err) {
    await registrarComunicacao({
      tipo: 'ausencia', destinatarios: [{ nome: person.nome, celular: person.celular, status: 'erro' }],
      conteudo: mensagem, status: 'erro', erros: [{ celular: person.celular, motivo: err.message }],
    });
    console.error(`[ENGAJAMENTO] Falha ao enviar para ${person.nome}:`, err.message);
    return false;
  } finally {
    if (person.email && faltas >= settings().semanasAlerta && settings().enviarEmail) {
      await sendEmail({
        to: person.email,
        subject: `Sentimos sua falta — ${churchName()}`,
        text: mensagem.replace(/[*_]/g, ''),
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;white-space:pre-wrap">${mensagem.replace(/[*_]/g, '')}</div>`,
      }).catch((e) => console.error('[ENGAJAMENTO] Falha no email:', e.message));
    }
  }
};

/**
 * Núcleo comum a EBD e encontros. `ctx` descreve a sessão:
 * { origem, grupoId, label, stats, lideres, onde (texto p/ mensagens), unidade ("domingos"|"encontros") }
 */
const processSession = async (sessao, ctx, { force = false } = {}) => {
  const cfg = settings();
  const tenant = getTenant();
  const podeMensagem = (cfg.ativo || force) && hasFeature(tenant, 'reengajamento') && whatsapp.isConfigured();
  const statsById = new Map(ctx.stats.map((s) => [s.personId, s]));
  const presentesIds = sessao.presencas.filter((p) => p.presente && p.personId).map((p) => String(p.personId));
  const ausentes = sessao.presencas.filter((p) => !p.presente && p.personId);
  const escopoAlerta = ctx.origem === 'encontro'
    ? { origem: 'encontro', grupoId: ctx.grupoId }
    : { origem: { $ne: 'encontro' } };

  const resumo = { ausentes: ausentes.length, enviadas: 0, pendentes: 0, alertas: 0, escaladas: 0, retornos: [] };
  const versaoLida = sessao.updatedAt; // o processamento leva minutos (IA + ritmo anti-ban)

  // 1) Quem voltou: fecha alertas abertos desta origem.
  const voltaram = await CareAlert.find({ ...escopoAlerta, personId: { $in: presentesIds }, status: { $in: ['aberto', 'em_contato'] } });
  for (const alert of voltaram) {
    alert.status = 'resolvido';
    alert.resolvidoEm = new Date();
    alert.faltasConsecutivas = 0;
    pushAcao(alert, { tipo: 'retorno', canal: 'presencial', descricao: `Presente em ${ctx.onde} de ${formatBr(sessao.data)}` });
    await alert.save();
    resumo.retornos.push(alert.nome);
  }

  // 2) Ausentes.
  // Só ativos: quem foi inativado (ex.: falecimento) depois da chamada não recebe "sentimos sua falta"
  const persons = await Person.find({ _id: { $in: ausentes.map((a) => a.personId) }, status: 'ativo' }).select('nome celular email').lean();
  const personById = new Map(persons.map((p) => [String(p._id), p]));
  if (podeMensagem && !sessao.resumo && (sessao.tema || sessao.descricao) && ctx.origem === 'ebd') {
    sessao.resumo = await generators.resumoAula(sessao);
  }

  const pendentes = [];
  for (const presenca of ausentes) {
    const id = String(presenca.personId);
    const person = personById.get(id);
    const faltas = statsById.get(id)?.faltasConsecutivas || 1;
    const nivel = levelFor(faltas, cfg.semanasAlerta);
    if (!person) continue;

    let alert = null;
    if (nivel) {
      alert = await CareAlert.findOne({ ...escopoAlerta, personId: id, status: { $in: ['aberto', 'em_contato'] } });
      if (!alert) {
        alert = new CareAlert({
          personId: id, nome: person.nome, celular: person.celular, classe: ctx.label, congregacao: sessao.congregacao,
          origem: ctx.origem, ...(ctx.grupoId ? { grupoId: ctx.grupoId } : {}),
        });
      }
      alert.nivel = nivel;
      alert.faltasConsecutivas = faltas;
      alert.ultimaPresenca = statsById.get(id)?.ultimaPresenca || alert.ultimaPresenca;
      await alert.save();
      resumo.alertas += 1;
    }

    const deveMandar = person.celular && (faltas >= 2 || cfg.mensagemPrimeiraFalta);
    if (podeMensagem && deveMandar && await AutomationRun.claim(`ausencia:${sessao._id}:${id}`, 'ausencia')) {
      const mensagem = await generators.mensagemAusente({ pessoa: person, aula: sessao, faltas, contexto: ctx });
      if (cfg.autoEnviar) {
        // O ritmo anti-ban (intervalo aleatório ≥30s, horário, limites) é aplicado no envio.
        if (await sendAbsenceMessage({ person, mensagem, aula: sessao, alert, faltas })) resumo.enviadas += 1;
      } else {
        pendentes.push({ personId: id, sessaoId: String(sessao._id), nome: person.nome, celular: person.celular, email: person.email, faltas, mensagem });
        if (alert) {
          alert.mensagemSugerida = mensagem;
          await alert.save();
        }
      }
    }

    // 3) Escalonamento: atingiu o limite → liderança (1x por semana por pessoa/origem).
    if (alert && nivel === 'critico' && (cfg.ativo || force)
      && (!alert.liderancaNotificadaEm || Date.now() - alert.liderancaNotificadaEm.getTime() > WEEK_MS - 3600e3)) {
      alert.precisaVisita = true;
      alert.liderancaNotificadaEm = new Date();
      pushAcao(alert, { tipo: 'lideranca_notificada', canal: 'whatsapp', descricao: `${faltas} faltas seguidas (${ctx.label})` });
      await alert.save();
      await notifyLeadership({
        tipo: 'ausencias',
        congregacao: sessao.congregacao,
        extra: ctx.lideres,
        texto: templates.liderancaAlertaAusencia({
          nome: person.nome, classe: ctx.label, congregacao: sessao.congregacao, faltas, celular: person.celular,
          motivo: alert.motivoInformado, unidade: ctx.unidade, onde: ctx.onde,
        }),
        emailSubject: `Alerta: ${person.nome} faltou ${faltas} ${ctx.unidade} seguidos (${ctx.label})`,
      });
      resumo.escaladas += 1;
    }
  }

  // 4) Aprovação pelo líder (quando o envio automático está desligado).
  if (pendentes.length) {
    resumo.pendentes = pendentes.length;
    for (const lider of ctx.lideres) {
      await Conversation.findOneAndUpdate(
        { canal: 'whatsapp', chave: whatsapp.sanitizeNumber(lider.celular) },
        { $set: { papel: 'lider', nome: lider.nome, state: { tipo: 'aprovacao_ausencia', sessaoId: String(sessao._id), itens: pendentes } } },
        { upsert: true },
      );
      await whatsapp.sendText(lider.celular, templates.aprovacaoAusentes(pendentes), { bulk: true }).catch((err) => {
        console.error('[ENGAJAMENTO] Falha ao pedir aprovação:', err.message);
      });
    }
  }

  // 5) Celebra retornos com os líderes.
  if (resumo.retornos.length && whatsapp.isConfigured()) {
    for (const lider of ctx.lideres) {
      await whatsapp.sendText(lider.celular, resumo.retornos.map((n) => templates.retornoMembro(n, ctx.label)).join('\n\n'), { bulk: true })
        .catch(() => {});
    }
  }

  // Se o líder corrigiu a chamada enquanto processávamos, não grava por cima: a correção limpou
  // ausenciasProcessadasEm e a sessão será reprocessada com as presenças novas.
  const atual = versaoLida ? await sessao.constructor.findById(sessao._id).select('updatedAt').lean() : null;
  if (versaoLida && atual && String(atual.updatedAt) !== String(versaoLida)) return resumo;
  sessao.ausenciasProcessadasEm = new Date();
  await sessao.save();
  return resumo;
};

/**
 * Processa uma aula da EBD recém-registrada: resolve alertas de quem voltou, abre/atualiza
 * alertas de ausentes, gera mensagens (IA) e envia ou pede aprovação, e escala à liderança.
 */
const processAula = async (aulaOrId, opts = {}) => {
  // ObjectId também expõe `_id`; por isso checamos `presencas` para saber se já é o documento.
  const aula = aulaOrId?.presencas ? aulaOrId : await EbdAula.findById(aulaOrId);
  if (!aula) return null;
  const stats = await personAttendance({ congregacao: aula.congregacao, classe: aula.classe });
  return processSession(aula, {
    origem: 'ebd', label: aula.classe, stats, lideres: classLeaders(aula.classe, aula.congregacao), onde: 'na EBD', unidade: 'domingos',
  }, opts);
};

// Mesmo fluxo para um encontro de grupo (união feminina, masculina…).
const processEncontro = async (encontroOrId, opts = {}) => {
  const encontro = encontroOrId?.presencas ? encontroOrId : await Encontro.findById(encontroOrId);
  if (!encontro) return null;
  if (encontro.ebdAulaId) return { ignorado: true, motivo: 'aula da EBD — tratada pela retenção da EBD' };
  if (getTenant()?.automacoes?.ausencia?.incluirEncontros === false && !opts.force) {
    encontro.ausenciasProcessadasEm = new Date();
    await encontro.save();
    return { ignorado: true };
  }
  const grupo = await GrupoEncontro.findById(encontro.grupoId).lean();
  const stats = await encontroAttendance({ grupoId: encontro.grupoId });
  return processSession(encontro, {
    origem: 'encontro',
    grupoId: encontro.grupoId,
    label: encontro.grupoNome || grupo?.nome,
    stats,
    lideres: (grupo?.lideres || []).filter((l) => l.celular),
    onde: `no encontro da ${encontro.grupoNome || grupo?.nome}`,
    unidade: 'encontros',
  }, opts);
};

// Envia mensagens aprovadas pelo líder. `indices` 1-based; vazio = todas.
const sendApproved = async (itens, indices = []) => {
  const escolhidos = indices.length ? itens.filter((_, i) => indices.includes(i + 1)) : itens;
  let enviadas = 0;
  for (const item of escolhidos) {
    const alert = await CareAlert.findOne({ personId: item.personId, status: { $in: ['aberto', 'em_contato'] } });
    // A mesma lista vai para todos os líderes: só a primeira aprovação envia
    if (item.sessaoId && !(await AutomationRun.claim(`ausencia-aprovada:${item.sessaoId}:${item.personId}`, 'ausencia'))) continue;
    if (!item.sessaoId && alert?.mensagemEnviadaEm && Date.now() - alert.mensagemEnviadaEm.getTime() < 864e5) continue;
    if (await sendAbsenceMessage({ person: item, mensagem: item.mensagem, aula: null, alert, faltas: item.faltas })) enviadas += 1;
  }
  return { enviadas, total: escolhidos.length };
};

// Dados agregados para o relatório semanal da liderança.
const weeklyReportData = async ({ isoDate }) => {
  const fim = new Date(`${isoDate}T23:59:59`);
  const inicio = new Date(fim.getTime() - WEEK_MS);
  const inicioAnterior = new Date(inicio.getTime() - WEEK_MS);
  const [semana, anterior, ov] = await Promise.all([
    EbdAula.find({ data: { $gte: inicio, $lte: fim } }).lean(),
    EbdAula.find({ data: { $gte: inicioAnterior, $lt: inicio } }).lean(),
    overview(),
  ]);
  const agg = (aulas) => {
    const byClasse = {};
    aulas.forEach((a) => {
      const k = `${a.classe} (${a.congregacao})`;
      byClasse[k] = byClasse[k] || { classe: k, presentes: 0, total: 0 };
      byClasse[k].total += a.presencas.length;
      byClasse[k].presentes += a.presencas.filter((p) => p.presente).length;
    });
    return Object.values(byClasse);
  };
  const classes = agg(semana);
  const presentes = classes.reduce((s, c) => s + c.presentes, 0);
  const total = classes.reduce((s, c) => s + c.total, 0);
  const prev = agg(anterior);
  const prevPct = prev.reduce((s, c) => s + c.total, 0)
    ? Math.round((prev.reduce((s, c) => s + c.presentes, 0) / prev.reduce((s, c) => s + c.total, 0)) * 100) : null;

  const today = new Date(`${isoDate}T12:00:00Z`);
  const pairs = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() + i * 86400000);
    return { day: d.getUTCDate(), month: d.getUTCMonth() + 1 };
  });
  const aniversariantes = await Person.aggregate([
    { $match: { status: 'ativo', dataNascimento: { $ne: null } } },
    { $addFields: { d: { $dayOfMonth: '$dataNascimento' }, m: { $month: '$dataNascimento' } } },
    { $match: { $or: pairs.map((p) => ({ d: p.day, m: p.month })) } },
    { $count: 'n' },
  ]);

  const retornos = await CareAlert.find({ status: 'resolvido', resolvidoEm: { $gte: inicio } }).select('nome').lean();

  return {
    periodo: `${formatBr(inicio)} a ${formatBr(fim)}`,
    presentes,
    total,
    percentual: total ? Math.round((presentes / total) * 100) : 0,
    percentualSemanaAnterior: prevPct,
    classes: classes.map((c) => ({ ...c, percentual: c.total ? Math.round((c.presentes / c.total) * 100) : 0 })),
    alertas: ov.emRisco.slice(0, 15).map((s) => ({
      nome: s.nome, classe: s.classe, congregacao: s.congregacao, faltasConsecutivas: s.faltasConsecutivas, nivel: s.nivel,
      motivo: s.alerta?.motivoInformado || null,
    })),
    retornos: retornos.map((r) => r.nome),
    aniversariantes: aniversariantes[0]?.n || 0,
  };
};

module.exports = {
  personAttendance, encontroAttendance, overview, processAula, processEncontro, sendApproved, sendAbsenceMessage, weeklyReportData, levelFor,
};
