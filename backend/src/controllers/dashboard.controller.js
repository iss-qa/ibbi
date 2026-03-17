const Person = require('../models/Person.model');

const isBirthdayInRange = (birthDate, start, end) => {
  if (!birthDate) return false;
  const year = start.getFullYear();
  const thisYear = new Date(year, birthDate.getMonth(), birthDate.getDate());
  const nextYear = new Date(year + 1, birthDate.getMonth(), birthDate.getDate());
  return (
    (thisYear >= start && thisYear <= end) ||
    (nextYear >= start && nextYear <= end && end.getFullYear() > start.getFullYear())
  );
};

const getDashboard = async (req, res) => {
  const { congregacao } = req.query;
  const filter = {};
  if (congregacao && congregacao !== 'Todos') filter.congregacao = congregacao;

  const [total, ativos, inativos, pessoas] = await Promise.all([
    Person.countDocuments(filter),
    Person.countDocuments({ ...filter, status: 'ativo' }),
    Person.countDocuments({ ...filter, status: 'inativo' }),
    Person.find({ ...filter, status: 'ativo', dataNascimento: { $ne: null } }).select('nome dataNascimento'),
  ]);

  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + 7);

  const aniversariantes = pessoas
    .filter((p) => isBirthdayInRange(p.dataNascimento, hoje, fim))
    .map((p) => ({
      _id: p._id,
      nome: p.nome,
      data: p.dataNascimento,
    }));

  res.json({
    total,
    ativos,
    inativos,
    aniversariantes,
  });
};

module.exports = { getDashboard };
