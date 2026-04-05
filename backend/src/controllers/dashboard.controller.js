const Person = require('../models/Person.model');
const { applyScopedCongregacaoFilter } = require('../utils/access');

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Bahia';

const toZonedDate = (date) =>
  new Date(date.toLocaleString('en-US', { timeZone: APP_TIMEZONE }));

const getBirthdayParts = (birthDate) => {
  if (!birthDate) return null;

  return {
    day: birthDate.getUTCDate(),
    month: birthDate.getUTCMonth(),
  };
};

const buildBirthdayForYear = (birthDate, year) => {
  const parts = getBirthdayParts(birthDate);
  if (!parts) return null;

  return new Date(year, parts.month, parts.day);
};

const isBirthdayInRange = (birthDate, start, end) => {
  if (!birthDate) return false;
  const year = start.getFullYear();
  const thisYear = buildBirthdayForYear(birthDate, year);
  const nextYear = buildBirthdayForYear(birthDate, year + 1);

  return (
    (thisYear >= start && thisYear <= end) ||
    (nextYear >= start && nextYear <= end && end.getFullYear() > start.getFullYear())
  );
};

const getDashboard = async (req, res) => {
  const { congregacao } = req.query;
  const filter = await applyScopedCongregacaoFilter(req.user, {}, congregacao);

  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

  const [total, ativos, inativos, pessoas, novosCadastros] = await Promise.all([
    Person.countDocuments(filter),
    Person.countDocuments({ ...filter, status: 'ativo' }),
    Person.countDocuments({ ...filter, status: 'inativo' }),
    Person.find({ ...filter, status: 'ativo', dataNascimento: { $ne: null } }).select('nome dataNascimento celular fotoUrl'),
    Person.countDocuments({ ...filter, createdAt: { $gte: seteDiasAtras } })
  ]);

  const agora = toZonedDate(new Date());
  const inicioSemana = new Date(agora);
  inicioSemana.setHours(0, 0, 0, 0);
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());

  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(fimSemana.getDate() + 6);
  fimSemana.setHours(23, 59, 59, 999);

  const mesAtual = agora.getMonth();

  const aniversariantes = pessoas
    .filter((p) => isBirthdayInRange(p.dataNascimento, inicioSemana, fimSemana))
    .sort((a, b) => {
      const dataA = buildBirthdayForYear(a.dataNascimento, inicioSemana.getFullYear());
      const dataB = buildBirthdayForYear(b.dataNascimento, inicioSemana.getFullYear());
      return dataA - dataB || a.nome.localeCompare(b.nome, 'pt-BR');
    })
    .map((p) => ({
      _id: p._id,
      nome: p.nome,
      data: p.dataNascimento,
      diaMes: String(getBirthdayParts(p.dataNascimento)?.day || '').padStart(2, '0'),
      celular: p.celular || '',
      fotoUrl: p.fotoUrl || '',
    }));

  const aniversariantesMes = pessoas
    .filter((p) => getBirthdayParts(p.dataNascimento)?.month === mesAtual)
    .sort((a, b) => {
      const diaA = getBirthdayParts(a.dataNascimento)?.day || 0;
      const diaB = getBirthdayParts(b.dataNascimento)?.day || 0;
      return diaA - diaB || a.nome.localeCompare(b.nome, 'pt-BR');
    })
    .map((p) => ({
      _id: p._id,
      nome: p.nome,
      data: p.dataNascimento,
      diaMes: String(getBirthdayParts(p.dataNascimento)?.day || '').padStart(2, '0'),
      celular: p.celular || '',
      fotoUrl: p.fotoUrl || '',
    }));

  res.json({
    total,
    ativos,
    inativos,
    aniversariantes,
    aniversariantesMes,
    novosCadastros,
  });
};

module.exports = { getDashboard };
