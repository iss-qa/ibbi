const requirePasswordChanged = (req, res, next) => {
  if (req.user && req.user.mustChangePassword) {
    return res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Troca de senha obrigatória antes de acessar o sistema.',
    });
  }
  return next();
};

module.exports = requirePasswordChanged;
