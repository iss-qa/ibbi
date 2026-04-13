const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User.model');
const Person = require('../models/Person.model');
const TriagemGrupo = require('../models/TriagemGrupo.model');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutos

const serializeUser = async (user) => {
  const person = user.personId ? await Person.findById(user.personId).select('congregacao tipo dataBatismo').lean() : null;

  let inTriagemGrupo = false;
  if (user.personId) {
    const count = await TriagemGrupo.countDocuments({
      'membros.membro_id': user.personId,
      ativo: true,
    });
    inTriagemGrupo = count > 0;
  }

  return {
    ...user.toJSON(),
    congregacao: person?.congregacao || '',
    tipo: person?.tipo || '',
    dataBatismo: person?.dataBatismo || null,
    inTriagemGrupo,
  };
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { login: loginInput, senha } = req.body;
  try {
    const user = await User.findOne({ login: loginInput }).select('+senha +failedLoginAttempts +lockedUntil');
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }
    if (!user.ativo) {
      return res.status(403).json({ message: 'Usuário inativo' });
    }

    // Verificar bloqueio temporário
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Conta bloqueada temporariamente. Tente novamente em ${minutesLeft} minuto(s).`,
      });
    }

    const match = await user.comparePassword(senha);
    if (!match) {
      // Incrementar tentativas falhas
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const update = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + LOCK_TIME_MS);
        update.failedLoginAttempts = 0;
      }
      await User.updateOne({ _id: user._id }, update);
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Login bem-sucedido: resetar tentativas
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await User.updateOne({ _id: user._id }, { failedLoginAttempts: 0, lockedUntil: null });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    const serialized = await serializeUser(user);
    return res.json({
      token,
      user: serialized,
      mustChangePassword: user.mustChangePassword || false,
    });
  } catch (error) {
    console.error('[AUTH ERROR]', error.message);
    return res.status(500).json({ message: error.message || 'Erro interno no login' });
  }
};

const me = async (req, res) => {
  return res.json({
    user: await serializeUser(req.user),
    mustChangePassword: req.user.mustChangePassword || false,
  });
};

module.exports = { login, me };
