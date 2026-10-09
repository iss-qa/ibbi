const EbdAula = require('../models/EbdAula.model');
const Person = require('../models/Person.model');
const { applyScopedCongregacaoFilter, assertPersonAccess, getUserCongregacao, resolveWritableCongregacao } = require('../utils/access');
const { escapeRegex } = require('../utils/sanitize');
const { dayRangeFromIso } = require('../utils/time');
const { sanitizePresencas } = require('../utils/presenca');

// Aulas ficam gravadas ao meio-dia (ensureSunday): busca por data é pelo dia inteiro, não igualdade.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayFilter = (value) => (ISO_DATE_RE.test(String(value).slice(0, 10)) ? dayRangeFromIso(String(value).slice(0, 10)) : null);

const ensureSunday = (date) => {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) throw new Error('Data inválida');
  if (d.getDay() !== 0) throw new Error('A aula deve ser em um domingo');
  return d;
};

const canEditAula = (aula, user) => {
  const hoje = new Date();
  const limite = new Date(aula.data);
  limite.setDate(limite.getDate() + 7);
  if (hoje <= limite) return true;
  return user.role === 'master';
};

const list = async (req, res) => {
  const { data, classe, congregacao, search, month, year } = req.query;
  let filter = {};
  if (data) {
    const range = dayFilter(data);
    if (!range) return res.status(400).json({ message: 'Data inválida (use AAAA-MM-DD)' });
    filter.data = range;
  }
  if (classe) filter.classe = classe;
  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { tema: new RegExp(safe, 'i') },
      { descricao: new RegExp(safe, 'i') },
    ];
  }
  if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0, 23, 59, 59);
    filter.data = { $gte: start, $lte: end };
  } else if (/^\d{4}$/.test(String(req.query.ano || ''))) {
    filter.data = anoRange(req.query.ano);
  }
  filter = await applyScopedCongregacaoFilter(req.user, filter, congregacao);
  // resumo=1: sem a lista de presenças, só as contagens (tela de aulas por classe)
  if (req.query.resumo) {
    const aulas = await EbdAula.find(filter).select('data tema descricao classe congregacao presencas.presente').sort({ data: -1 }).lean();
    return res.json(aulas.map(({ presencas = [], ...a }) => ({ ...a, total: presencas.length, presentes: presencas.filter((p) => p.presente).length })));
  }
  const aulas = await EbdAula.find(filter).sort({ data: -1 });
  return res.json(aulas);
};

const anoRange = (ano) => ({ $gte: new Date(Date.UTC(Number(ano), 0, 1)), $lt: new Date(Date.UTC(Number(ano) + 1, 0, 1)) });
const pct = (presentes, total) => (total ? Math.round((presentes / total) * 100) : null);
const media = (lista) => {
  const vals = lista.filter((v) => v !== null);
  return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
};

/**
 * Painel da EBD: indicadores do mês e um card por classe/congregação (média, último domingo, tendência).
 * ?ano=AAAA (padrão: ano atual) e ?congregacao=
 */
const painel = async (req, res) => {
  const ano = /^\d{4}$/.test(String(req.query.ano || '')) ? Number(req.query.ano) : new Date().getUTCFullYear();
  const filter = await applyScopedCongregacaoFilter(req.user, { data: anoRange(ano) }, req.query.congregacao);
  const aulas = await EbdAula.aggregate([
    { $match: filter },
    { $project: { classe: 1, congregacao: 1, data: 1, total: { $size: '$presencas' }, presentes: { $size: { $filter: { input: '$presencas', cond: '$$this.presente' } } } } },
    { $sort: { data: -1 } },
  ]);
  const anosDisponiveis = (await EbdAula.aggregate([
    { $match: await applyScopedCongregacaoFilter(req.user, {}, req.query.congregacao) },
    { $group: { _id: { $year: '$data' } } },
  ])).map((a) => a._id).filter(Boolean).sort((a, b) => b - a);

  const grupos = new Map();
  aulas.forEach((a) => {
    const key = `${a.classe}|${a.congregacao}`;
    if (!grupos.has(key)) grupos.set(key, { classe: a.classe, congregacao: a.congregacao, aulas: [] });
    grupos.get(key).aulas.push({ data: a.data, pct: pct(a.presentes, a.total), presentes: a.presentes, total: a.total });
  });

  const agora = new Date();
  const mesAtual = (d) => d.getUTCFullYear() === agora.getUTCFullYear() && d.getUTCMonth() === agora.getUTCMonth();
  const doMes = aulas.filter((a) => mesAtual(new Date(a.data)));
  const ultimoDia = aulas[0] ? new Date(aulas[0].data).toISOString().slice(0, 10) : null;
  const doUltimo = aulas.filter((a) => new Date(a.data).toISOString().slice(0, 10) === ultimoDia);
  const somar = (lista, k) => lista.reduce((s, a) => s + a[k], 0);

  res.json({
    ano,
    anosDisponiveis: [...new Set([new Date().getUTCFullYear(), ...anosDisponiveis])].sort((a, b) => b - a),
    kpis: {
      aulasMes: doMes.length,
      mediaMes: media(doMes.map((a) => pct(a.presentes, a.total))),
      mediaAno: media(aulas.map((a) => pct(a.presentes, a.total))),
      classes: grupos.size,
      ultimoDomingo: ultimoDia ? { data: ultimoDia, presentes: somar(doUltimo, 'presentes'), total: somar(doUltimo, 'total'), pct: pct(somar(doUltimo, 'presentes'), somar(doUltimo, 'total')) } : null,
    },
    grupos: [...grupos.values()].map((g) => {
      const [ultima, ...anteriores] = g.aulas;
      const mediaAnteriores = media(anteriores.slice(0, 4).map((a) => a.pct));
      return {
        classe: g.classe,
        congregacao: g.congregacao,
        aulas: g.aulas.length,
        media: media(g.aulas.map((a) => a.pct)),
        ultima,
        tendencia: ultima?.pct !== null && mediaAnteriores !== null ? ultima.pct - mediaAnteriores : null,
      };
    }),
  });
};

const getById = async (req, res) => {
  const aula = await EbdAula.findById(req.params.id);
  if (!aula) return res.status(404).json({ message: 'Aula não encontrada' });
  await assertPersonAccess(req.user, { congregacao: aula.congregacao });
  res.json(aula);
};

const create = async (req, res) => {
  try {
    const data = ensureSunday(req.body.data);
    const { tema, descricao, professor, classe } = req.body;
    const congregacao = await resolveWritableCongregacao(req.user, req.body.congregacao);

    const existing = await EbdAula.findOne({ data, classe, congregacao });
    if (congregacao && req.tenant?.congregacoes?.length && !req.tenant.congregacoes.includes(congregacao)) {
      return res.status(400).json({ message: 'Congregação inválida' });
    }
    if (existing) return res.status(409).json({ message: 'Aula já registrada para essa classe' });

    const pessoas = await Person.find({
      grupo: classeMapToGrupo(classe),
      status: 'ativo',
      congregacao,
    }).select('nome');
    const presencas = pessoas.map((p) => ({ personId: p._id, nome: p.nome, presente: true }));

    const aula = await EbdAula.create({
      data,
      tema,
      descricao,
      professor,
      classe,
      congregacao,
      presencas,
      registradoPor: req.user._id,
    });

    res.status(201).json(aula);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const update = async (req, res) => {
  const aula = await EbdAula.findById(req.params.id);
  if (!aula) return res.status(404).json({ message: 'Aula não encontrada' });
  await assertPersonAccess(req.user, { congregacao: aula.congregacao });
  if (!canEditAula(aula, req.user)) return res.status(403).json({ message: 'Edição bloqueada' });

  // Só os campos editáveis da aula (presenças têm rota própria; origem/registradoPor/foto são internos)
  const EDITABLE = ['data', 'tema', 'descricao', 'professor', 'classe', 'congregacao', 'resumo'];
  const updates = Object.fromEntries(EDITABLE.filter((k) => req.body?.[k] !== undefined).map((k) => [k, req.body[k]]));
  if (updates.data) {
    try {
      updates.data = ensureSunday(updates.data);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
  if (req.user.role !== 'master') {
    updates.congregacao = await resolveWritableCongregacao(req.user, updates.congregacao || aula.congregacao);
  }

  const updated = await EbdAula.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  res.json(updated);
};

const updatePresencas = async (req, res) => {
  const aula = await EbdAula.findById(req.params.id);
  if (!aula) return res.status(404).json({ message: 'Aula não encontrada' });
  await assertPersonAccess(req.user, { congregacao: aula.congregacao });
  if (!canEditAula(aula, req.user)) return res.status(403).json({ message: 'Edição bloqueada' });

  aula.presencas = sanitizePresencas(req.body?.presencas);
  aula.ausenciasProcessadasEm = undefined; // reprocessa ausências (idempotente por pessoa)
  await aula.save();
  res.json(aula);
};

const remove = async (req, res) => {
  const aula = await EbdAula.findByIdAndDelete(req.params.id);
  if (!aula) return res.status(404).json({ message: 'Aula não encontrada' });
  res.json({ message: 'Aula removida' });
};

const getBySunday = async (req, res) => {
  const data = dayFilter(req.params.date);
  if (!data) return res.status(400).json({ message: 'Data inválida (use AAAA-MM-DD)' });
  const filter = await applyScopedCongregacaoFilter(req.user, { data });
  const aulas = await EbdAula.find(filter);
  res.json(aulas);
};

const reportByClasse = async (req, res) => {
  const { grupo } = req.params;
  const filter = await applyScopedCongregacaoFilter(req.user, { classe: grupo });
  const aulas = await EbdAula.find(filter);
  const stats = {};
  aulas.forEach((aula) => {
    aula.presencas.forEach((p) => {
      if (!stats[p.personId]) {
        stats[p.personId] = { nome: p.nome, presencas: 0, faltas: 0 };
      }
      if (p.presente) stats[p.personId].presencas += 1;
      else stats[p.personId].faltas += 1;
    });
  });

  res.json(Object.values(stats));
};

const reportByPessoa = async (req, res) => {
  const { id } = req.params;
  const filter = await applyScopedCongregacaoFilter(req.user, { 'presencas.personId': id });
  const aulas = await EbdAula.find(filter);
  const history = aulas.map((aula) => {
    const pres = aula.presencas.find((p) => String(p.personId) === id);
    return { data: aula.data, classe: aula.classe, presente: pres?.presente ?? false };
  });
  res.json(history);
};

const reportGeral = async (req, res) => {
  const filter = await applyScopedCongregacaoFilter(req.user);
  const aulas = await EbdAula.find(filter);
  const summary = {};
  aulas.forEach((aula) => {
    if (!summary[aula.classe]) summary[aula.classe] = { classe: aula.classe, total: 0, presentes: 0 };
    summary[aula.classe].total += aula.presencas.length;
    summary[aula.classe].presentes += aula.presencas.filter((p) => p.presente).length;
  });

  const data = Object.values(summary).map((s) => ({
    ...s,
    percentual: s.total ? Math.round((s.presentes / s.total) * 100) : 0,
  }));

  res.json(data);
};

const classeMapToGrupo = (classe) => {
  const map = {
    'Crianças': 'criança',
    'Adolescentes': 'adolescente',
    'Jovens': 'jovem',
    'Adultos 1': 'adulto 1',
    'Adultos 2': 'adulto 2',
    'Idosos': 'idoso',
    'Anciãos': 'ancião',
  };
  return map[classe] || classe;
};

module.exports = {
  painel,
  list,
  getById,
  create,
  update,
  updatePresencas,
  remove,
  getBySunday,
  reportByClasse,
  reportByPessoa,
  reportGeral,
};
