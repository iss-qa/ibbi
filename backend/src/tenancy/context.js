const { AsyncLocalStorage } = require('async_hooks');

// Contexto de tenant por requisição/job. Todo acesso a collections com o
// tenantPlugin exige um tenant no contexto (ou bypass explícito de plataforma).
const storage = new AsyncLocalStorage();

const toTenantInfo = (tenant) => {
  if (!tenant) return null;
  if (typeof tenant === 'string' || tenant._bsontype === 'ObjectId' || tenant._bsontype === 'ObjectID') {
    return { tenantId: String(tenant), tenant: null };
  }
  return { tenantId: String(tenant._id), tenant };
};

const runWithTenant = (tenant, fn) => {
  const info = toTenantInfo(tenant);
  if (!info) throw new Error('runWithTenant: tenant obrigatório');
  return storage.run({ ...info, bypass: false }, fn);
};

// Executa sem filtro de tenant — uso exclusivo de rotinas da plataforma
// (painel administrativo, billing, bootstrap, resolução de webhooks).
const runAsPlatform = (fn) => storage.run({ tenantId: null, tenant: null, bypass: true }, fn);

const getStore = () => storage.getStore() || null;
const getTenantId = () => getStore()?.tenantId || null;
const getTenant = () => getStore()?.tenant || null;
const isBypass = () => Boolean(getStore()?.bypass);

const requireTenantId = () => {
  const tenantId = getTenantId();
  if (!tenantId) {
    const err = new Error('Contexto de igreja (tenant) ausente');
    err.status = 500;
    throw err;
  }
  return tenantId;
};

module.exports = {
  runWithTenant,
  runAsPlatform,
  getTenantId,
  getTenant,
  isBypass,
  requireTenantId,
};
