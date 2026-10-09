const cron = require('node-cron');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const EbdAula = require('../models/EbdAula.model');
const Encontro = require('../models/Encontro.model');
const GrupoEncontro = require('../models/GrupoEncontro.model');
const encontrosSvc = require('./encontro.service');
const AutomationRun = require('../models/AutomationRun.model');
const templates = require('../templates/messages.templates');
const whatsapp = require('./whatsapp.service');
const { generateBirthdayCard } = require('./image.service');
const { sendBirthdayEmail } = require('./birthday-email.service');
const { notifyLeadership } = require('./leadership.service');
const engagement = require('./engagement.service');
const ebd = require('./ebd.service');
const generators = require('./ai/generators');
const { openChamada, openChamadaEncontro } = require('./ai/inbound.service');
const { runBillingCycle } = require('./billing.service');
const { getTenant, runWithTenant, runAsPlatform } = require('../tenancy/context');
const { listActiveTenants } = require('../tenancy/tenant.service');
const { timezone } = require('../tenancy/brand');
const { hasFeature } = require('../config/plans');
const { zonedParts, isoWeekKey, isoToBr } = require('../utils/time');

const toZonedDate = (date) =>
  new Date(date.toLocaleString('en-US', { timeZone: timezone() }));

const getBirthdayParts = (birthDate) => ({
  day: birthDate.getUTCDate(),
  month: birthDate.getUTCMonth() + 1,
});

const findBirthdaysToday = async () => {
  const now = toZonedDate(new Date());
  const day = now.getDate();
  const month = now.getMonth() + 1;

  const people = await Person.find({
    status: 'ativo',
    celular: { $nin: [null, ''] },
    dataNascimento: { $ne: null },
  });

  return people.filter((person) => {
    const birthday = getBirthdayParts(person.dataNascimento);
    return birthday.day === day && birthday.month === month;
  });
};

// Aniversários do tenant do contexto atual.
const sendBirthdayMessages = async () => {
  const tenant = getTenant();
  const cfg = tenant?.automacoes?.aniversario || {};
  if (tenant && cfg.ativo === false) return { todos: [], enviados: 0 };

  const todosAniversariantes = await findBirthdaysToday();
  if (todosAniversariantes.length === 0) return { todos: [], enviados: 0 };

  // Idempotência: ignora quem já recebeu mensagem de aniversário com sucesso hoje
  const startOfDay = toZonedDate(new Date());
  startOfDay.setHours(0, 0, 0, 0);

  const celulares = todosAniversariantes.map((p) => p.celular).filter(Boolean);
  const jaEnviadas = celulares.length
    ? await Message.find({
      tipo: 'aniversario',
      criadoEm: { $gte: startOfDay },
      'destinatarios.celular': { $in: celulares },
      'destinatarios.status': 'concluido',
    }).select('destinatarios').lean()
    : [];

  const celularesEnviadosHoje = new Set();
  for (const msg of jaEnviadas) {
    for (const dest of msg.destinatarios || []) {
      if (dest.status === 'concluido' && dest.celular) {
        celularesEnviadosHoje.add(dest.celular);
      }
    }
  }

  const aniversariantes = todosAniversariantes.filter(
    (p) => !celularesEnviadosHoje.has(p.celular),
  );

  if (aniversariantes.length === 0) {
    console.log(`[scheduler] ${todosAniversariantes.length} aniversariantes hoje, todos já receberam.`);
    return { todos: todosAniversariantes, enviados: 0, startOfDay };
  }

  const destinatarios = aniversariantes.map((p, index) => ({
    nome: p.nome,
    celular: p.celular,
    status: 'pendente',
    ordem: index,
  }));

  const messageLog = await Message.create({
    tipo: 'aniversario',
    destinatarios,
    conteudo: 'Envio automático de aniversário',
    status: 'enviando',
  });

  const erros = [];
  let enviados = 0;

  for (let i = 0; i < aniversariantes.length; i++) {
    const person = aniversariantes[i];
    let destStatus = 'concluido';
    let destErro;

    try {
      await whatsapp.sendProactive({
        number: person.celular,
        text: templates.aniversario(person.nome),
        templateKey: 'aniversario',
        templateParams: [person.nome.split(' ')[0]],
      });

      enviados += 1;

      // O texto já foi entregue: falha no cartão não pode marcar erro (senão o texto
      // é reenviado a cada nova tentativa).
      let imageBuffer = null;
      try {
        imageBuffer = await generateBirthdayCard(person, 'portrait');
        await whatsapp.sendMedia(person.celular, '', imageBuffer.toString('base64'));
      } catch (cardErr) {
        console.error(`[scheduler] Cartão de aniversário não enviado para ${person.nome}:`, cardErr.message);
      }

      // Canal secundário: email de aniversário com o mesmo cartão embutido.
      // Idempotência própria (1x por dia por pessoa): só envia se ainda não
      // enviou hoje. Roda em try/catch próprio para não afetar o WhatsApp.
      const emailJaEnviadoHoje =
        person.aniversarioEmailEnviadoEm && person.aniversarioEmailEnviadoEm >= startOfDay;
      if (cfg.enviarEmail !== false && person.email && !emailJaEnviadoHoje) {
        try {
          await sendBirthdayEmail(person, imageBuffer);
          await Person.updateOne(
            { _id: person._id },
            { $set: { aniversarioEmailEnviadoEm: new Date() } },
          );
          console.log(`[scheduler] Email de aniversário enviado para ${person.nome} <${person.email}>`);
        } catch (emailErr) {
          console.error(`[scheduler] Falha ao enviar email de aniversário para ${person.nome}:`, emailErr.message);
        }
      }
    } catch (err) {
      destStatus = 'erro';
      destErro = err.message;
      erros.push({ celular: person.celular, motivo: err.message });
      console.error(`Erro ao enviar aniversário para ${person.nome}:`, err.message);
    }

    await Message.updateOne(
      { _id: messageLog._id },
      {
        $set: {
          'destinatarios.$[dest].status': destStatus,
          'destinatarios.$[dest].processadoEm': new Date(),
          ...(destErro ? { 'destinatarios.$[dest].erro': destErro } : {}),
        },
      },
      { arrayFilters: [{ 'dest.ordem': i }] },
    );

  }

  const status = erros.length > 0 ? (enviados > 0 ? 'concluido' : 'erro') : 'concluido';
  await Message.findByIdAndUpdate(messageLog._id, {
    status,
    concluidoEm: new Date(),
    erros,
  });

  return { todos: todosAniversariantes, enviados, startOfDay };
};

// "Os irmãos A e B fazem aniversário hoje; as felicitações já foram enviadas." — 1x por dia.
const notifyLeadershipBirthdays = async ({ todos, startOfDay }) => {
  const tenant = getTenant();
  if (!todos?.length || tenant?.automacoes?.aniversario?.notificarLideranca === false) return;
  const hoje = zonedParts(timezone()).isoDate;
  if (!(await AutomationRun.claim(`aniversario-lideranca:${hoje}`, 'aniversario'))) return;

  const enviadas = await Message.find({
    tipo: 'aniversario',
    criadoEm: { $gte: startOfDay },
    'destinatarios.status': 'concluido',
  }).select('destinatarios').lean();
  const okZap = new Set(enviadas.flatMap((m) => m.destinatarios.filter((d) => d.status === 'concluido').map((d) => d.celular)));
  const atualizados = await Person.find({ _id: { $in: todos.map((p) => p._id) } }).select('nome congregacao celular aniversarioEmailEnviadoEm').lean();

  const pessoas = atualizados.map((p) => {
    const canais = [];
    if (okZap.has(p.celular)) canais.push('WhatsApp ✅');
    if (p.aniversarioEmailEnviadoEm && p.aniversarioEmailEnviadoEm >= startOfDay) canais.push('email ✅');
    return { nome: p.nome, congregacao: p.congregacao, canais: canais.join(' + ') || 'envio pendente ⚠️' };
  });
  await notifyLeadership({
    tipo: 'aniversarios',
    texto: templates.liderancaAniversarios(pessoas),
    emailSubject: `Aniversariantes de hoje (${pessoas.length})`,
  });
};

// ── Automações por tenant ────────────────────────────────────────────────
const running = new Set();
const once = async (key, fn) => {
  if (running.has(key)) return;
  running.add(key);
  try {
    await fn();
  } finally {
    running.delete(key);
  }
};

// Bodas (dataCasamento) e aniversário de batismo (dataBatismo): parabéns automáticos no dia,
// uma vez por dia por igreja, pela fila anti-ban. Batizados/casados no próprio ano não recebem.
const DATAS_COMEMORATIVAS = [
  { campo: 'dataCasamento', tipo: 'casamento', template: templates.aniversarioCasamento },
  { campo: 'dataBatismo', tipo: 'batismo', template: templates.aniversarioBatismo },
];
const sendAnniversaryMessages = async () => {
  const tenant = getTenant();
  if (tenant?.automacoes?.aniversario?.ativo === false) return 0;
  const now = toZonedDate(new Date());
  const hoje = now.toISOString().slice(0, 10);
  if (!(await AutomationRun.claim(`bodas-batismo:${hoje}`, 'aniversario'))) return 0;
  const destinatarios = [];
  for (const { campo, tipo, template } of DATAS_COMEMORATIVAS) {
    const people = await Person.find({ status: 'ativo', celular: { $nin: [null, ''] }, [campo]: { $ne: null } }).select(`nome celular ${campo}`).lean();
    people.forEach((p) => {
      const d = new Date(p[campo]);
      const anos = now.getFullYear() - d.getUTCFullYear();
      if (anos < 1 || d.getUTCDate() !== now.getDate() || d.getUTCMonth() !== now.getMonth()) return;
      destinatarios.push({ nome: p.nome, celular: p.celular, texto: template(p.nome, anos), tipo });
    });
  }
  if (!destinatarios.length) return 0;
  await whatsapp.sendBatch(destinatarios, (d) => d.texto, {
    onSuccess: (d) => Message.create({ tipo: 'aniversario', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'concluido' }], conteudo: d.texto, status: 'concluido', origemNome: d.nome, concluidoEm: new Date() }).catch(() => {}),
    onError: (d, err) => Message.create({ tipo: 'aniversario', destinatarios: [{ nome: d.nome, celular: d.celular, status: 'erro' }], conteudo: d.texto, status: 'erro', erros: [{ celular: d.celular, motivo: err.message }] }).catch(() => {}),
  });
  console.log(`[scheduler] Bodas/batismo: ${destinatarios.length} mensagem(ns) na fila.`);
  return destinatarios.length;
};

const runBirthdays = async () => {
  const result = await sendBirthdayMessages();
  await notifyLeadershipBirthdays(result);
  await sendAnniversaryMessages();
};

// Domingo, no horário configurado: convoca cada líder de EBD para a chamada pelo WhatsApp.
const runChamadaEbd = async (now) => {
  const tenant = getTenant();
  for (const lider of tenant.ebdLideres || []) {
    const key = `chamada:${now.isoDate}:${lider.classe}:${lider.congregacao}:${lider.celular}`;
    if (!(await AutomationRun.claim(key, 'chamada'))) continue;
    const existente = await ebd.findAula({ isoDate: now.isoDate, classe: lider.classe, congregacao: lider.congregacao });
    if (existente && existente.origem !== 'web') continue;
    const roster = (await ebd.getRoster(lider.classe, lider.congregacao))
      .sort((a, b) => ebd.normalize(a.nome).localeCompare(ebd.normalize(b.nome)));
    if (!roster.length) continue;
    await openChamada({ lider, classe: lider.classe, congregacao: lider.congregacao, isoDate: now.isoDate, roster });
    await whatsapp.sendText(lider.celular, templates.convocacaoChamadaEbd(lider.nome, lider.classe, isoToBr(now.isoDate), roster), { bulk: true })
      .catch((err) => console.error('[scheduler] Falha na convocação da chamada:', err.message));
  }
};

// Varredura: aulas registradas pelo painel web e ainda não processadas (dá 30 min para ajustes).
const runAbsenceSweep = async () => {
  const aulas = await EbdAula.find({
    ausenciasProcessadasEm: null,
    data: { $gte: new Date(Date.now() - 3 * 24 * 3600e3) },
    updatedAt: { $lte: new Date(Date.now() - 30 * 60e3) },
  }).select('_id');
  for (const { _id } of aulas) {
    await engagement.processAula(_id).catch((err) => console.error('[scheduler] Falha ao processar aula:', err.message));
  }
};

// Dia do encontro, após o horário: pede a chamada aos líderes do grupo pelo WhatsApp.
const runChamadaEncontros = async (now) => {
  const grupos = await GrupoEncontro.find({ ativo: true, convocarChamada: true, diaSemana: now.weekday, tipo: { $ne: 'ebd' } }).lean();
  for (const grupo of grupos) {
    if (now.hhmm < (grupo.horaChamada || '21:30') || !grupo.membros?.length) continue;
    const existente = await encontrosSvc.findEncontro({ grupoId: grupo._id, isoDate: now.isoDate });
    if (existente && existente.origem !== 'web') continue;
    const roster = encontrosSvc.sortedMembers(grupo);
    for (const lider of (grupo.lideres || []).filter((l) => l.celular)) {
      if (!(await AutomationRun.claim(`chamada-encontro:${now.isoDate}:${grupo._id}:${lider.celular}`, 'chamada'))) continue;
      await openChamadaEncontro({ lider, grupo, isoDate: now.isoDate, roster });
      await whatsapp.sendText(lider.celular, templates.convocacaoChamadaEncontro(lider.nome, grupo.nome, isoToBr(now.isoDate), roster), { bulk: true })
        .catch((err) => console.error('[scheduler] Falha na convocação do encontro:', err.message));
    }
  }
};

// Encontros registrados pelo painel e ainda não processados (30 min para ajustes).
const runEncontroSweep = async () => {
  const lista = await Encontro.find({
    ausenciasProcessadasEm: null,
    ebdAulaId: null,
    data: { $gte: new Date(Date.now() - 3 * 24 * 3600e3) },
    updatedAt: { $lte: new Date(Date.now() - 30 * 60e3) },
  }).select('_id');
  for (const { _id } of lista) {
    await engagement.processEncontro(_id).catch((err) => console.error('[scheduler] Falha ao processar encontro:', err.message));
  }
};

const runWeeklyReport = async (now) => {
  const key = `relatorio:${isoWeekKey(now.isoDate)}`;
  if (!(await AutomationRun.claim(key, 'relatorio'))) return;
  const dados = await engagement.weeklyReportData({ isoDate: now.isoDate });
  const texto = await generators.relatorioSemanal(dados);
  await notifyLeadership({ tipo: 'relatorio', texto, emailSubject: `Resumo semanal — ${dados.periodo}` });
};

// Resumos de encontro aprovados pelo líder: 1h depois vão para os membros do grupo,
// em ordem aleatória, pela fila (intervalo aleatório ≥ 30s entre mensagens).
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const runResumosEncontro = async () => {
  for (;;) {
    // Claim atômico: um resumo só entra na fila uma vez, mesmo com dois processos.
    const encontro = await Encontro.findOneAndUpdate(
      { 'resumo.status': 'agendado', 'resumo.enviarEm': { $lte: new Date() } },
      { $set: { 'resumo.status': 'enviando' } },
      { new: true },
    ).lean();
    if (!encontro) return;
    const grupo = await GrupoEncontro.findById(encontro.grupoId).select('membros nome').lean();
    const destinatarios = shuffle((grupo?.membros || []).filter((m) => m.celular)).map((m, i) => ({ nome: m.nome, celular: m.celular, ordem: i }));
    if (!destinatarios.length) {
      await Encontro.updateOne({ _id: encontro._id }, { $set: { 'resumo.status': 'enviado', 'resumo.enviadoEm': new Date(), 'resumo.destinatarios': 0 } });
      continue;
    }
    const dados = { grupo: encontro.grupoNome, data: isoToBr(new Date(encontro.data).toISOString().slice(0, 10)), texto: encontro.resumo.texto };
    const log = await Message.create({
      tipo: 'resumo_encontro',
      destinatarios: destinatarios.map((d) => ({ nome: d.nome, celular: d.celular, status: 'pendente', ordem: d.ordem })),
      conteudo: templates.resumoMembro('{nome}', dados),
      status: 'enviando', enviadoPor: encontro.resumo.autorId, origemNome: encontro.resumo.autorNome, origemCongregacao: encontro.congregacao,
    });
    let restantes = destinatarios.length;
    const concluir = async () => {
      restantes -= 1;
      if (restantes > 0) return;
      await Encontro.updateOne({ _id: encontro._id }, { $set: { 'resumo.status': 'enviado', 'resumo.enviadoEm': new Date(), 'resumo.destinatarios': destinatarios.length } });
      await Message.updateOne({ _id: log._id }, { $set: { status: 'concluido', concluidoEm: new Date() } });
    };
    const marcar = (ordem, patch) => Message.updateOne(
      { _id: log._id },
      { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`destinatarios.$[d].${k}`, v])) },
      { arrayFilters: [{ 'd.ordem': ordem }] },
    );
    await whatsapp.sendBatch(destinatarios, (d) => templates.resumoMembro(d.nome, dados), {
      onSuccess: (d) => marcar(d.ordem, { status: 'concluido', processadoEm: new Date() }).then(concluir),
      onError: (d, err) => marcar(d.ordem, { status: 'erro', processadoEm: new Date(), erro: err.message }).then(concluir),
    });
    console.log(`[scheduler] Resumo de ${encontro.grupoNome} enfileirado para ${destinatarios.length} membro(s).`);
  }
};

const tickTenant = async (tenant, { startup = false } = {}) => {
  if (startup && await AutomationRun.claim('ebd-dentro-das-unioes-v2', 'migracao')) {
    encontrosSvc.migrarEbdParaUnioes()
      .then((r) => console.log(`[scheduler] EBD dentro das uniões (${tenant.slug}):`, JSON.stringify(r)))
      .catch((err) => console.error('[scheduler] Migração EBD→uniões:', err.message));
  }
  if (startup && await AutomationRun.claim('pedidos-oracao-v1', 'migracao')) {
    require('./prayer.service').importarPedidosAntigos()
      .then((n) => n && console.log(`[scheduler] ${n} pedido(s) de oração importado(s) do histórico (${tenant.slug}).`))
      .catch((err) => console.error('[scheduler] Importação de pedidos de oração:', err.message));
  }
  const id = String(tenant._id);
  const now = zonedParts(tenant.timezone || 'America/Bahia');
  const a = tenant.automacoes || {};
  const wa = whatsapp.isConfigured(tenant);
  if (!wa) return;

  const horaAniversario = a.aniversario?.hora || '08:00';
  if ((startup || now.minute < 5) && now.hhmm >= horaAniversario) {
    once(`${id}:aniversario`, runBirthdays).catch((err) => console.error('[scheduler] Aniversários:', err));
  }

  if (now.weekday === 0 && a.chamadaEbd?.ativo && now.hhmm >= (a.chamadaEbd.hora || '11:30')
    && hasFeature(tenant, 'agenteWhatsApp')) {
    once(`${id}:chamada`, () => runChamadaEbd(now)).catch((err) => console.error('[scheduler] Chamada:', err));
  }

  if (a.ausencia?.ativo && hasFeature(tenant, 'reengajamento')
    && ((now.weekday === 0 && now.hour >= 14) || now.weekday === 1)) {
    once(`${id}:ausencias`, runAbsenceSweep).catch((err) => console.error('[scheduler] Ausências:', err));
  }

  // Jornada do visitante: 1x/dia a partir do horário da igreja (padrão 10:00).
  if (hasFeature(tenant, 'jornadaVisitante') && a.jornada?.ativo !== false && now.hhmm >= (a.jornada?.hora || '10:00')) {
    once(`${id}:jornada`, async () => {
      if (!(await AutomationRun.claim(`jornada:${now.isoDate}`, 'jornada'))) return;
      const r = await require('./jornada.service').runJornadas();
      if (r.enviadas || r.concluidas) console.log(`[scheduler] Jornada (${tenant.slug}): ${r.enviadas} mensagem(ns), ${r.concluidas} concluída(s).`);
    }).catch((err) => console.error('[scheduler] Jornada:', err));
  }

  // Escalas: lembrete na véspera (padrão 18:00) para quem confirmou.
  if (hasFeature(tenant, 'escalas') && now.hhmm >= (a.escalas?.lembreteHora || '18:00')) {
    once(`${id}:escalas`, async () => {
      if (!(await AutomationRun.claim(`escala-lembrete:${now.isoDate}`, 'escala'))) return;
      await require('./escala.service').runLembretes();
    }).catch((err) => console.error('[scheduler] Escalas:', err));
  }

  once(`${id}:resumos-encontro`, runResumosEncontro).catch((err) => console.error('[scheduler] Resumos de encontro:', err));

  if (hasFeature(tenant, 'agenteWhatsApp')) {
    once(`${id}:chamada-encontros`, () => runChamadaEncontros(now)).catch((err) => console.error('[scheduler] Chamada encontros:', err));
  }

  if (a.ausencia?.ativo && a.ausencia?.incluirEncontros !== false && hasFeature(tenant, 'reengajamento') && now.minute < 5) {
    once(`${id}:ausencias-encontros`, runEncontroSweep).catch((err) => console.error('[scheduler] Ausências encontros:', err));
  }

  if (a.relatorioSemanal?.ativo && hasFeature(tenant, 'relatorioSemanalIA')
    && now.weekday === (a.relatorioSemanal.diaSemana ?? 1) && now.hhmm >= (a.relatorioSemanal.hora || '08:00')) {
    once(`${id}:relatorio`, () => runWeeklyReport(now)).catch((err) => console.error('[scheduler] Relatório:', err));
  }
};

const tickAll = async (opts) => {
  const tenants = await listActiveTenants();
  for (const tenant of tenants) {
    // Cada tenant roda no próprio contexto; as tarefas longas seguem em segundo plano.
    await runWithTenant(tenant, () => tickTenant(tenant, opts)).catch((err) => console.error(`[scheduler] ${tenant.slug}:`, err));
  }
};

const startScheduler = () => {
  // Checagem na inicialização: se o servidor reiniciou (deploy), envia quem faltou.
  setTimeout(() => {
    console.log('[scheduler] Verificação inicial das automações...');
    tickAll({ startup: true }).catch((err) => console.error('[scheduler] Erro na inicialização:', err));
  }, 10000);

  cron.schedule('*/5 * * * *', () => {
    tickAll().catch((err) => console.error('[scheduler] Erro no tick:', err));
  });

  // Billing da plataforma: diário às 06:00 (horário de Brasília).
  cron.schedule('0 6 * * *', () => {
    runAsPlatform(runBillingCycle)
      .then((r) => console.log('[billing] Ciclo diário:', r))
      .catch((err) => console.error('[billing] Erro no ciclo:', err));
  }, { timezone: 'America/Sao_Paulo' });
};

module.exports = { startScheduler, sendBirthdayMessages, sendAnniversaryMessages, notifyLeadershipBirthdays, tickTenant, runResumosEncontro };
