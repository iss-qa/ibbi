const Person = require('../models/Person.model');
const { applyScopedCongregacaoFilter } = require('../utils/access');

const lastMonths = (count) => {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString('pt-BR', { month: 'short' }),
    });
  }
  return months;
};

const growth = async (req, res) => {
  const { congregacao } = req.query;
  const baseFilter = await applyScopedCongregacaoFilter(req.user, {}, congregacao);
  const months = lastMonths(6);

  const start = new Date(months[0].year, months[0].month - 1, 1);
  const end = new Date(months[months.length - 1].year, months[months.length - 1].month, 0, 23, 59, 59);

  const results = await Person.aggregate([
    { $match: { ...baseFilter, createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, total: { $sum: 1 } } },
  ]);

  const map = {};
  results.forEach((r) => { map[`${r._id.y}-${r._id.m}`] = r.total; });

  const data = months.map((m) => ({
    month: m.label,
    total: map[`${m.year}-${m.month}`] || 0,
  }));

  res.json(data);
};

const byCongregation = async (req, res) => {
  const { congregacao } = req.query;
  const scopedFilter = await applyScopedCongregacaoFilter(req.user, {}, congregacao);
  const data = await Person.aggregate([
    { $match: scopedFilter },
    { $group: { _id: '$congregacao', total: { $sum: 1 } } },
    { $project: { congregacao: '$_id', total: 1, _id: 0 } },
    { $sort: { total: -1 } },
  ]);
  res.json(data);
};

const byGroup = async (req, res) => {
  const { congregacao } = req.query;
  const scopedFilter = await applyScopedCongregacaoFilter(req.user, {}, congregacao);
  const data = await Person.aggregate([
    { $match: scopedFilter },
    { $group: { _id: '$grupo', total: { $sum: 1 } } },
    { $project: { grupo: '$_id', total: 1, _id: 0 } },
    { $sort: { total: -1 } },
  ]);
  res.json(data);
};

const retention = async (req, res) => {
  const { congregacao } = req.query;
  const baseFilter = await applyScopedCongregacaoFilter(req.user, {}, congregacao);
  const months = lastMonths(6);

  const start = new Date(months[0].year, months[0].month - 1, 1);
  const end = new Date(months[months.length - 1].year, months[months.length - 1].month, 0, 23, 59, 59);

  const [entradas, saidas] = await Promise.all([
    Person.aggregate([
      { $match: { ...baseFilter, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, total: { $sum: 1 } } },
    ]),
    Person.aggregate([
      { $match: { ...baseFilter, status: 'inativo', updatedAt: { $gte: start, $lte: end } } },
      { $group: { _id: { y: { $year: '$updatedAt' }, m: { $month: '$updatedAt' } }, total: { $sum: 1 } } },
    ]),
  ]);

  const entradasMap = {};
  entradas.forEach((r) => { entradasMap[`${r._id.y}-${r._id.m}`] = r.total; });
  const saidasMap = {};
  saidas.forEach((r) => { saidasMap[`${r._id.y}-${r._id.m}`] = r.total; });

  const data = months.map((m) => ({
    month: m.label,
    entradas: entradasMap[`${m.year}-${m.month}`] || 0,
    saidas: saidasMap[`${m.year}-${m.month}`] || 0,
  }));

  res.json(data);
};

module.exports = { growth, byCongregation, byGroup, retention };
