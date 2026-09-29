const mongoose = require('mongoose');
const { bootstrapTenancy } = require('../tenancy/bootstrap');
const { getTenantBySlug, DEFAULT_TENANT_SLUG } = require('../tenancy/tenant.service');
const { runWithTenant } = require('../tenancy/context');

// Executa um script de manutenção no contexto de uma igreja.
// Igreja: env TENANT_SLUG (padrão: DEFAULT_TENANT_SLUG / "ibbi").
const runInTenant = async (main) => {
  await mongoose.connect(process.env.MONGO_URI);
  await bootstrapTenancy();
  const slug = process.env.TENANT_SLUG || DEFAULT_TENANT_SLUG();
  const tenant = await getTenantBySlug(slug);
  if (!tenant) throw new Error(`Igreja "${slug}" não encontrada`);
  console.log(`[script] Executando no contexto da igreja ${tenant.nome} (${tenant.slug})`);
  return runWithTenant(tenant, main);
};

module.exports = { runInTenant };
