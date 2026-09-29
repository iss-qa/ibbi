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

  // Hooks no estilo next(err): um throw síncrono aqui escapa da promise do
  // Mongoose e derruba o processo inteiro (uncaughtException).
  schema.pre(QUERY_OPS, { document: false, query: true }, function scopeQuery(next) {
    try {
      if (isBypass()) return next();
      const tenantId = requireTenantId();
      this.where({ tenantId });
      if (typeof this.getUpdate === 'function') stripTenantFromUpdate(this.getUpdate());
      return next();
    } catch (err) {
      return next(err);
    }
  });

  schema.pre('aggregate', function scopeAggregate(next) {
    try {
      if (isBypass()) return next();
      const tenantId = requireTenantId();
      this.pipeline().unshift({ $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } });
      return next();
    } catch (err) {
      return next(err);
    }
  });

  schema.pre('validate', function assignTenant(next) {
    const tenantId = getTenantId();
    if (!this.tenantId) {
      if (!tenantId && !isBypass()) {
        try { requireTenantId(); } catch (err) { return next(err); }
      }
      if (tenantId) this.tenantId = tenantId;
      return next();
    }
    if (tenantId && String(this.tenantId) !== String(tenantId)) {
      const err = new Error('Documento pertence a outra igreja (tenant)');
      err.status = 403;
      return next(err);
    }
    return next();
  });

  schema.pre('insertMany', function assignTenantMany(next, docs) {
    const tenantId = getTenantId();
    if (!tenantId && !isBypass()) return next(new Error('Contexto de igreja (tenant) ausente'));
    (Array.isArray(docs) ? docs : [docs]).forEach((doc) => {
      if (doc && !doc.tenantId && tenantId) doc.tenantId = tenantId;
    });
    return next();
  });
};
