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
  const data = await Promise.all(
    months.map(async (m) => {
      const start = new Date(m.year, m.month - 1, 1);
      const end = new Date(m.year, m.month, 0, 23, 59, 59);
      const total = await Person.countDocuments({ ...baseFilter, createdAt: { $gte: start, $lte: end } });
      return { month: m.label, total };
    })
  );
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
  const data = await Promise.all(
    months.map(async (m) => {
      const start = new Date(m.year, m.month - 1, 1);
      const end = new Date(m.year, m.month, 0, 23, 59, 59);
      const entradas = await Person.countDocuments({ ...baseFilter, createdAt: { $gte: start, $lte: end } });
      const saidas = await Person.countDocuments({ ...baseFilter, status: 'inativo', updatedAt: { $gte: start, $lte: end } });
      return { month: m.label, entradas, saidas };
    })
  );
  res.json(data);
};

module.exports = { growth, byCongregation, byGroup, retention };
