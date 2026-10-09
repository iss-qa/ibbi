const { signUserToken } = require('../utils/token');
const { validationResult } = require('express-validator');
const User = require('../models/User.model');
const Person = require('../models/Person.model');
const TriagemGrupo = require('../models/TriagemGrupo.model');
const { getTenant } = require('../tenancy/context');
const { serializePublic } = require('../tenancy/tenant.service');
const { getUserCongregacoes } = require('../utils/access');

const bcrypt = require('bcryptjs');
const { LEGACY_DEFAULT_PASSWORDS } = require('../config/defaults');

const MAX_FAILED_ATTEMPTS = 5;
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);
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
    tenant: serializePublic(getTenant()),
    // Congregações que o usuário gere (master: todas da igreja)
    congregacoesPermitidas: user.role === 'user'
      ? []
      : (await getUserCongregacoes(user).catch(() => [])) || getTenant()?.congregacoes || [],
  };
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Apenas strings: um objeto ({ "$ne": null }) viraria operador na query do Mongo.
  const { login: loginInput, senha } = req.body;
  if (typeof loginInput !== 'string' || typeof senha !== 'string' || !loginInput.trim() || !senha) {
    return res.status(400).json({ message: 'Login e senha são obrigatórios' });
  }
  try {
    const user = await User.findOne({ login: loginInput }).select('+senha +failedLoginAttempts +lockedUntil');
    if (!user) {
      // bcrypt mesmo sem usuário: o tempo de resposta não revela quais logins existem
      await bcrypt.compare(senha, DUMMY_HASH);
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Bloqueio temporário: mesma resposta de senha errada (não confirma que a conta existe)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(401).json({ message: 'Credenciais inválidas ou conta temporariamente bloqueada. Tente mais tarde.' });
    }

    const match = await user.comparePassword(senha);
    if (!match) {
      // Incremento atômico: tentativas em paralelo não leem contador desatualizado
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { failedLoginAttempts: 1 } },
        { new: true, projection: { failedLoginAttempts: 1 } },
      );
      if ((updated?.failedLoginAttempts || 0) >= MAX_FAILED_ATTEMPTS) {
        await User.updateOne({ _id: user._id }, { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_TIME_MS) });
      }
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Senha provisória vencida, ou a antiga senha padrão compartilhada (conhecida por todos os membros)
    if (user.mustChangePassword) {
      const expirada = user.senhaTemporariaExpiraEm
        ? user.senhaTemporariaExpiraEm < new Date()
        : LEGACY_DEFAULT_PASSWORDS.includes(senha);
      if (expirada) {
        return res.status(401).json({
          code: 'TEMP_PASSWORD_EXPIRED',
          message: 'Sua senha provisória expirou. Peça a um líder da igreja para gerar uma nova.',
        });
      }
    }

    // Só revela "inativo" para quem acertou a senha (não enumera contas)
    if (!user.ativo) {
      return res.status(403).json({ message: 'Usuário inativo' });
    }

    // Login bem-sucedido: resetar tentativas
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await User.updateOne({ _id: user._id }, { failedLoginAttempts: 0, lockedUntil: null });
    }

    const token = signUserToken(user);

    const serialized = await serializeUser(user);
    return res.json({
      token,
      user: serialized,
      mustChangePassword: user.mustChangePassword || false,
    });
  } catch (error) {
    console.error('[AUTH ERROR]', error.message);
    return res.status(500).json({ message: 'Erro interno no login' });
  }
};

const me = async (req, res) => {
  return res.json({
    user: await serializeUser(req.user),
    mustChangePassword: req.user.mustChangePassword || false,
  });
};

module.exports = { login, me };
