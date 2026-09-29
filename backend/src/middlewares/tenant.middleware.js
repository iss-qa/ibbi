const { runWithTenant } = require('../tenancy/context');
const { getTenantBySlug, slugFromRequest } = require('../tenancy/tenant.service');

// Para rotas públicas (login): resolve a igreja pelo slug e executa no contexto dela.
const resolveTenant = async (req, res, next) => {
  const tenant = await getTenantBySlug(slugFromRequest(req));
  if (!tenant) return res.status(404).json({ message: 'Igreja não encontrada. Verifique o código da igreja.' });
  if (tenant.status === 'cancelada') return res.status(403).json({ message: 'Esta igreja não está mais ativa na plataforma.' });
  req.tenant = tenant;
  return runWithTenant(tenant, () => next());
};

module.exports = { resolveTenant };
