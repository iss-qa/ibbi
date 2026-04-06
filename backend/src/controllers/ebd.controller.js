const EbdAula = require('../models/EbdAula.model');
const Person = require('../models/Person.model');
const { applyScopedCongregacaoFilter, assertPersonAccess, getUserCongregacao } = require('../utils/access');
const { escapeRegex } = require('../utils/sanitize');

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
  if (data) filter.data = new Date(data);
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
  }
  filter = await applyScopedCongregacaoFilter(req.user, filter, congregacao);
  const aulas = await EbdAula.find(filter).sort({ data: -1 });
  res.json(aulas);
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
    const congregacao = req.user.role === 'master'
      ? req.body.congregacao
      : await getUserCongregacao(req.user);

    const existing = await EbdAula.findOne({ data, classe, congregacao });
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

  const updates = { ...req.body };
  if (updates.data) {
    try {
      updates.data = ensureSunday(updates.data);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  }
  if (req.user.role !== 'master') {
    updates.congregacao = await getUserCongregacao(req.user);
  }

  const updated = await EbdAula.findByIdAndUpdate(req.params.id, updates, { new: true });
  res.json(updated);
};

const updatePresencas = async (req, res) => {
  const aula = await EbdAula.findById(req.params.id);
  if (!aula) return res.status(404).json({ message: 'Aula não encontrada' });
  await assertPersonAccess(req.user, { congregacao: aula.congregacao });
  if (!canEditAula(aula, req.user)) return res.status(403).json({ message: 'Edição bloqueada' });

  aula.presencas = req.body.presencas || [];
  await aula.save();
  res.json(aula);
};

const remove = async (req, res) => {
  const aula = await EbdAula.findByIdAndDelete(req.params.id);
  if (!aula) return res.status(404).json({ message: 'Aula não encontrada' });
  res.json({ message: 'Aula removida' });
};

const getBySunday = async (req, res) => {
  const data = new Date(req.params.date);
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
