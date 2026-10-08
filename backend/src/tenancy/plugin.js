const mongoose = require('mongoose');
const { getTenantId, isBypass, requireTenantId } = require('./context');

const QUERY_OPS = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
];

const stripTenantFromUpdate = (update) => {
  if (!update || typeof update !== 'object') return;
  delete update.tenantId;
  ['$set', '$setOnInsert', '$unset'].forEach((op) => {
    if (update[op]) delete update[op].tenantId;
  });
};

/**
 * Isolamento multi-tenant (shared database, coluna tenantId).
 * - Adiciona tenantId em todo documento.
 * - Injeta { tenantId } em toda query/aggregate a partir do AsyncLocalStorage.
 * - Falha fechado: sem tenant no contexto (e sem bypass de plataforma) a operação lança erro.
 */
module.exports = function tenantPlugin(schema) {
  schema.add({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  });

  // Hooks síncronos (sem `next`): no estilo callback o Mongoose executa o hook fora do
  // AsyncLocalStorage de quem montou a query e o contexto da igreja se perde. Erros lançados
  // aqui rejeitam a promise da query e caem no error handler (utils/async-errors).
  schema.pre(QUERY_OPS, { document: false, query: true }, function scopeQuery() {
    if (isBypass()) return;
    const tenantId = requireTenantId();
    this.where({ tenantId });
    if (typeof this.getUpdate === 'function') stripTenantFromUpdate(this.getUpdate());
  });

  schema.pre('aggregate', function scopeAggregate() {
    if (isBypass()) return;
    const tenantId = requireTenantId();
    this.pipeline().unshift({ $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } });
  });

  schema.pre('validate', function assignTenant() {
    const tenantId = getTenantId();
    if (!this.tenantId) {
      if (!tenantId && !isBypass()) requireTenantId();
      if (tenantId) this.tenantId = tenantId;
      return;
    }
    if (tenantId && String(this.tenantId) !== String(tenantId)) {
      const err = new Error('Documento pertence a outra igreja (tenant)');
      err.status = 403;
      throw err;
    }
  });

  schema.pre('insertMany', function assignTenantMany(next, docs) {
    const tenantId = getTenantId();
    if (!tenantId && !isBypass()) return next(new Error('Contexto de igreja (tenant) ausente'));
    (Array.isArray(docs) ? docs : [docs]).forEach((doc) => {
      if (doc && !doc.tenantId && tenantId) doc.tenantId = tenantId;
    });
    // Com { lean: true } o validate não roda: barra aqui documento de outra igreja
    const foreign = tenantId && (Array.isArray(docs) ? docs : [docs])
      .some((doc) => doc?.tenantId && String(doc.tenantId) !== String(tenantId));
    if (foreign) return next(new Error('Documento pertence a outra igreja (tenant)'));
    return next();
  });
};
