const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User.model');

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { login: loginInput, senha } = req.body;
  const user = await User.findOne({ login: loginInput });
  if (!user) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }
  if (!user.ativo) {
    return res.status(403).json({ message: 'Usuário inativo' });
  }
  const match = await user.comparePassword(senha);
  if (!match) {
    return res.status(401).json({ message: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  return res.json({ token, user: user.toJSON() });
};

const me = async (req, res) => {
  return res.json({ user: req.user.toJSON() });
};

module.exports = { login, me };
