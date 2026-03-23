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
  const lastName = normalizePiece(parts.length > 1 ? parts[parts.length - 1] : parts[0]);

  if (!firstName && !lastName) return 'usuario';
  if (!lastName || firstName === lastName) return firstName || lastName;

  return `${firstName}.${lastName}`;
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
