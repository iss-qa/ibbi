const Person = require('../models/Person.model');

const createForbiddenError = (message) => {
  const error = new Error(message);
  error.status = 403;
  return error;
};

const getUserCongregacao = async (user) => {
  if (!user || user.role === 'master') return null;

  if (!user.personId) {
    throw createForbiddenError('Admin sem membro vinculado à congregação');
  }

  const person = await Person.findById(user.personId).select('congregacao').lean();
  if (!person?.congregacao) {
    throw createForbiddenError('Admin sem congregação vinculada');
  }

  return person.congregacao;
};

const applyScopedCongregacaoFilter = async (user, filter = {}, requestedCongregacao) => {
  const scopedFilter = { ...filter };

  if (user?.role === 'master') {
    if (requestedCongregacao && requestedCongregacao !== 'Todos') {
      scopedFilter.congregacao = requestedCongregacao;
    }
    return scopedFilter;
  }

  if (user?.role === 'user') {
    scopedFilter._id = user.personId;
    return scopedFilter;
  }

  const congregacao = await getUserCongregacao(user);
  scopedFilter.congregacao = congregacao;
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

  const congregacao = await getUserCongregacao(user);
  if (!person || person.congregacao !== congregacao) {
    throw createForbiddenError('Acesso permitido apenas para membros da sua congregação');
  }
};

module.exports = {
  getUserCongregacao,
  applyScopedCongregacaoFilter,
  assertPersonAccess,
};
