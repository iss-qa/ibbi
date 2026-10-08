const jwt = require('jsonwebtoken');

// JWT de usuário da igreja (tid = igreja). Validado em auth.middleware.
const signUserToken = (user) => jwt.sign(
  { id: user._id, tid: String(user.tenantId), role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
);

// Token emitido antes da última troca/reset de senha não vale mais (iat em segundos).
const issuedBeforePasswordChange = (payload, user) => Boolean(
  user.passwordChangedAt && payload.iat && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000),
);

module.exports = { signUserToken, issuedBeforePasswordChange };
