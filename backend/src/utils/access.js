const Person = require('../models/Person.model');

const createForbiddenError = (message) => {
  const error = new Error(message);
  error.status = 403;
  return error;
};

/**
 * Congregações que o usuário pode gerir.
 * - master: todas (retorna null)
 * - admin: User.congregacoesAcesso definido pelo master; vazio = congregação do próprio cadastro
 */
const getUserCongregacoes = async (user) => {
  if (!user || user.role === 'master') return null;

  if (user.congregacoesAcesso?.length) return [...user.congregacoesAcesso];

  if (!user.personId) {
    throw createForbiddenError('Admin sem membro vinculado à congregação');
  }
  const person = await Person.findById(user.personId).select('congregacao').lean();
  if (!person?.congregacao) {
    throw createForbiddenError('Admin sem congregação vinculada');
  }
  return [person.congregacao];
};

// Congregação principal (primeira da lista). null para master.
const getUserCongregacao = async (user) => {
  const lista = await getUserCongregacoes(user);
  return lista ? lista[0] : null;
};

const canAccessCongregacao = async (user, congregacao) => {
  const lista = await getUserCongregacoes(user);
  return !lista || lista.includes(congregacao);
};

// Congregação para gravar um registro: a pedida, se permitida; senão a principal do usuário.
const resolveWritableCongregacao = async (user, requested) => {
  const lista = await getUserCongregacoes(user);
  if (!lista) return requested;
  return requested && lista.includes(requested) ? requested : lista[0];
};

const applyScopedCongregacaoFilter = async (user, filter = {}, requestedCongregacao) => {
  const scopedFilter = { ...filter };
  const requested = requestedCongregacao && requestedCongregacao !== 'Todos' ? requestedCongregacao : null;

  if (user?.role === 'master') {
    if (requested) scopedFilter.congregacao = requested;
    return scopedFilter;
  }

  if (user?.role === 'user') {
    scopedFilter._id = user.personId;
    return scopedFilter;
  }

  const lista = await getUserCongregacoes(user);
  if (requested && lista.includes(requested)) scopedFilter.congregacao = requested;
  else scopedFilter.congregacao = lista.length === 1 ? lista[0] : { $in: lista };
  return scopedFilter;
};

const assertPersonAccess = async (user, person) => {
  if (user?.role === 'master') return;

  if (user?.role === 'user') {
    if (!person || String(person._id) !== String(user.personId)) {
      throw createForbiddenError('Usuários comuns só podem acessar seus próprios dados');
    }
    return;
  }

  if (!person || !(await canAccessCongregacao(user, person.congregacao))) {
    throw createForbiddenError('Acesso permitido apenas para membros das suas congregações');
  }
};

module.exports = {
  getUserCongregacoes,
  getUserCongregacao,
  canAccessCongregacao,
  resolveWritableCongregacao,
  applyScopedCongregacaoFilter,
  assertPersonAccess,
};
