const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { runWithTenant, runAsPlatform } = require('../tenancy/context');
const { getTenantById } = require('../tenancy/tenant.service');
const { issuedBeforePasswordChange } = require('../utils/token');

// Rotas que continuam acessíveis com a igreja suspensa (para regularizar a assinatura).
const SUSPENDED_ALLOWED = ['/api/tenant', '/api/auth/me'];

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Token não informado' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido' });
  }
  if (payload.aud === 'platform') {
    return res.status(401).json({ message: 'Token inválido' });
  }

  // Tokens emitidos antes do multi-tenant não têm `tid`: resolve pelo usuário.
  let tenantId = payload.tid;
  if (!tenantId) {
    const legacy = await runAsPlatform(() => User.findById(payload.id).select('tenantId').lean());
    tenantId = legacy?.tenantId;
  }
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return res.status(401).json({ message: 'Igreja não encontrada para este usuário' });
  }

  return runWithTenant(tenant, async () => {
    const user = await User.findById(payload.id);
    if (!user || !user.ativo) {
      return res.status(401).json({ message: 'Usuário inválido ou inativo' });
    }
    if (issuedBeforePasswordChange(payload, user)) {
      return res.status(401).json({ message: 'Sessão expirada: a senha foi alterada. Entre novamente.' });
    }
    if (['suspensa', 'cancelada'].includes(tenant.status)
      && !SUSPENDED_ALLOWED.some((p) => req.originalUrl.startsWith(p))) {
      return res.status(402).json({
        code: 'TENANT_SUSPENDED',
        message: tenant.status === 'cancelada'
          ? 'A assinatura desta igreja foi cancelada.'
          : 'Acesso suspenso por pendência financeira. Regularize em "Assinatura".',
      });
    }
    req.user = user;
    req.tenant = tenant;
    // Igreja demonstração: somente leitura, decidido pela igreja (não pelo token) — vale para qualquer login nela.
    if (tenant.demo && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return res.status(403).json({ code: 'DEMO_READONLY', message: 'Igreja demonstração: somente leitura. Cadastre a sua igreja para usar de verdade (14 dias grátis).' });
    }
    return next();
  });
};

module.exports = authMiddleware;
