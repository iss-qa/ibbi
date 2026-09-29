const jwt = require('jsonwebtoken');
const PlatformUser = require('../models/PlatformUser.model');
const { runAsPlatform } = require('../tenancy/context');

// Operadores da plataforma: JWT com aud "platform"; tudo roda sem filtro de tenant.
const platformAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Token não informado' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { audience: 'platform' });
  } catch {
    return res.status(401).json({ message: 'Token inválido' });
  }

  return runAsPlatform(async () => {
    const admin = await PlatformUser.findById(payload.id);
    if (!admin || !admin.ativo) return res.status(401).json({ message: 'Operador inválido ou inativo' });
    req.platformUser = admin;
    return next();
  });
};

const signPlatformToken = (admin) => jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
  audience: 'platform',
  expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || '12h',
});

module.exports = { platformAuth, signPlatformToken };
