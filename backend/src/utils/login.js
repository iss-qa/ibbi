const User = require('../models/User.model');

const normalizePiece = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const buildBaseLogin = (personName) => {
  const parts = String(personName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'usuario';

  const firstName = normalizePiece(parts[0]);
  const secondName = normalizePiece(parts.length > 1 ? parts[1] : '');

  if (!firstName && !secondName) return 'usuario';
  
  return `${firstName}${secondName}`;
};

const buildUniqueLogin = async (personName) => {
  const base = buildBaseLogin(personName);
  let login = base;
  let counter = 1;

  while (await User.findOne({ login })) {
    login = `${base}${counter}`;
    counter += 1;
  }

  return login;
};

module.exports = {
  buildBaseLogin,
  buildUniqueLogin,
};
