const crypto = require('crypto');

const SEED_MASTER_PASSWORD = process.env.SEED_MASTER_PASSWORD;

// Não existe mais senha padrão compartilhada: cada conta nova/resetada recebe uma senha
// provisória aleatória, válida por TEMP_PASSWORD_TTL_MS e trocada no primeiro acesso.
// As antigas (DEFAULT_USER_PASSWORD / 'IBBI2026') eram conhecidas por todos os membros e
// passam a ser recusadas no login de contas que ainda não trocaram a senha.
const LEGACY_DEFAULT_PASSWORDS = [...new Set([process.env.DEFAULT_USER_PASSWORD, 'IBBI2026'].filter(Boolean))];
const TEMP_PASSWORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Sem caracteres ambíguos (0/O, 1/l/I): a senha é digitada a partir do WhatsApp.
const TEMP_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const generateTempPassword = (len = 8) => Array.from(crypto.randomBytes(len), (b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]).join('');

/** Define uma senha provisória nova no documento (não salva). Devolve a senha em texto claro. */
const applyTempPassword = (user) => {
  const senha = generateTempPassword();
  user.senha = senha;
  user.mustChangePassword = true;
  user.senhaTemporariaExpiraEm = new Date(Date.now() + TEMP_PASSWORD_TTL_MS);
  user.passwordChangedAt = new Date(); // derruba sessões abertas da conta
  return senha;
};

module.exports = {
  SEED_MASTER_PASSWORD, LEGACY_DEFAULT_PASSWORDS, TEMP_PASSWORD_TTL_MS, generateTempPassword, applyTempPassword,
};
