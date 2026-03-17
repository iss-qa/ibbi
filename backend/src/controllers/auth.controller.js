const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User.model');

const login = async (req, res) => {
  console.log('[AUTH] Recebendo tentativa de login:', req.body.login);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('[AUTH] Erro de validação de campos');
    return res.status(400).json({ errors: errors.array() });
  }

  const { login: loginInput, senha } = req.body;
  try {
    const user = await User.findOne({ login: loginInput }).select('+senha');
    if (!user) {
      console.log('[AUTH] Usuário não encontrado:', loginInput);
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }
    if (!user.ativo) {
      console.log('[AUTH] Usuário inativo:', loginInput);
      return res.status(403).json({ message: 'Usuário inativo' });
    }

    console.log('[AUTH] Comparando senha para:', loginInput);
    const match = await user.comparePassword(senha);
    if (!match) {
      console.log('[AUTH] Senha incorreta para:', loginInput);
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    console.log('[AUTH] Login realizado com sucesso para:', loginInput);
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    return res.json({ token, user: user.toJSON() });
  } catch (error) {
    console.error('[AUTH ERROR]', error.message);
    return res.status(500).json({ message: error.message || 'Erro interno no login' });
  }
};

const me = async (req, res) => {
  return res.json({ user: req.user.toJSON() });
};

module.exports = { login, me };
