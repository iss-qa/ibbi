const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const { applyScopedCongregacaoFilter } = require('../utils/access');

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Bahia';

const toZonedDate = (date) =>
  new Date(date.toLocaleString('en-US', { timeZone: APP_TIMEZONE }));

const buildWeekDayMonthPairs = (start, end) => {
  const pairs = [];
  const cur = new Date(start);
  cur.setHours(12, 0, 0, 0);
  const last = new Date(end);
  last.setHours(12, 0, 0, 0);
  while (cur <= last) {
    pairs.push({ day: cur.getDate(), month: cur.getMonth() + 1 });
    cur.setDate(cur.getDate() + 1);
  }
  return pairs;
};

const projectBirthdayPerson = (p) => ({
  _id: p._id,
  nome: p.nome,
  data: p.dataNascimento,
  diaMes: String(p.bDay).padStart(2, '0'),
  bDay: p.bDay,
  bMonth: p.bMonth,
  celular: p.celular || '',
  fotoUrl: p.fotoUrl || '',
  congregacao: p.congregacao || '',
});

const getDashboard = async (req, res) => {
  const { congregacao } = req.query;
  const filter = await applyScopedCongregacaoFilter(req.user, {}, congregacao);

  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

  const agora = toZonedDate(new Date());
  const inicioSemana = new Date(agora);
  inicioSemana.setHours(0, 0, 0, 0);
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());

  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(fimSemana.getDate() + 6);
  fimSemana.setHours(23, 59, 59, 999);

  const mesAtual = agora.getMonth() + 1;
  const diaAtual = agora.getDate();
  const weekPairs = buildWeekDayMonthPairs(inicioSemana, fimSemana);

  const birthdayBaseFilter = { ...filter, status: 'ativo', dataNascimento: { $ne: null } };

  const [counts, aniversariantesSemanaRaw, aniversariantesMesRaw, novosCadastros] = await Promise.all([
    Person.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          ativos: { $sum: { $cond: [{ $eq: ['$status', 'ativo'] }, 1, 0] } },
          inativos: { $sum: { $cond: [{ $eq: ['$status', 'inativo'] }, 1, 0] } },
        },
      },
    ]),
    Person.aggregate([
      { $match: birthdayBaseFilter },
      {
        $addFields: {
          bDay: { $dayOfMonth: { date: '$dataNascimento', timezone: 'UTC' } },
          bMonth: { $month: { date: '$dataNascimento', timezone: 'UTC' } },
        },
      },
      { $match: { $or: weekPairs.map((p) => ({ bDay: p.day, bMonth: p.month })) } },
      { $sort: { bMonth: 1, bDay: 1, nome: 1 } },
      {
        $project: {
          nome: 1,
          dataNascimento: 1,
          celular: 1,
          fotoUrl: 1,
          congregacao: 1,
          bDay: 1,
          bMonth: 1,
        },
      },
    ]),
    Person.aggregate([
      { $match: birthdayBaseFilter },
      {
        $addFields: {
          bDay: { $dayOfMonth: { date: '$dataNascimento', timezone: 'UTC' } },
          bMonth: { $month: { date: '$dataNascimento', timezone: 'UTC' } },
        },
      },
      { $match: { bMonth: mesAtual } },
      { $sort: { bDay: 1, nome: 1 } },
      {
        $project: {
          nome: 1,
          dataNascimento: 1,
          celular: 1,
          fotoUrl: 1,
          congregacao: 1,
          bDay: 1,
          bMonth: 1,
        },
      },
    ]),
    Person.countDocuments({ ...filter, createdAt: { $gte: seteDiasAtras } }),
  ]);

  const totalsRow = counts[0] || { total: 0, ativos: 0, inativos: 0 };
  const aniversariantes = aniversariantesSemanaRaw.map(projectBirthdayPerson);
  const aniversariantesMes = aniversariantesMesRaw.map(projectBirthdayPerson);

  // Anota cada aniversariante com info da última mensagem 'aniversario' enviada com sucesso
  // no ano corrente (manual ou pelo scheduler). Usado pelo dashboard para sinalizar quem já
  // recebeu o cartão.
  const celulares = [
    ...new Set(
      [...aniversariantes, ...aniversariantesMes]
        .map((p) => p.celular)
        .filter(Boolean),
    ),
  ];

  const sentMap = new Map();
  if (celulares.length > 0) {
    const inicioAno = new Date(agora.getFullYear(), 0, 1);
    const mensagens = await Message.find({
      tipo: 'aniversario',
      criadoEm: { $gte: inicioAno },
      'destinatarios.celular': { $in: celulares },
      'destinatarios.status': 'concluido',
    })
      .select('_id criadoEm concluidoEm destinatarios')
      .sort({ criadoEm: -1 })
      .lean();

    for (const msg of mensagens) {
      for (const dest of msg.destinatarios || []) {
        if (dest.status !== 'concluido' || !dest.celular) continue;
        if (!celulares.includes(dest.celular)) continue;
        const existing = sentMap.get(dest.celular);
        const enviadoEm = dest.processadoEm || msg.concluidoEm || msg.criadoEm;
        if (!existing || new Date(enviadoEm) > new Date(existing.enviadoEm)) {
          sentMap.set(dest.celular, {
            enviadoEm,
            mensagemId: msg._id,
          });
        }
      }
    }
  }

  const annotateMensagem = (p) => {
    const info = p.celular ? sentMap.get(p.celular) : null;
    return {
      ...p,
      mensagemEnviada: Boolean(info),
      mensagemEnviadaEm: info?.enviadoEm || null,
      mensagemId: info?.mensagemId || null,
    };
  };

  const aniversariantesAnotados = aniversariantes.map(annotateMensagem);
  const aniversariantesMesAnotados = aniversariantesMes.map(annotateMensagem);
  const aniversariantesHoje = aniversariantesAnotados.filter(
    (p) => p.bDay === diaAtual && p.bMonth === mesAtual,
  ).length;

  res.set('Cache-Control', 'private, max-age=30');
  res.json({
    total: totalsRow.total,
    ativos: totalsRow.ativos,
    inativos: totalsRow.inativos,
    aniversariantes: aniversariantesAnotados,
    aniversariantesMes: aniversariantesMesAnotados,
    aniversariantesHoje,
    novosCadastros,
  });
};

module.exports = { getDashboard };
