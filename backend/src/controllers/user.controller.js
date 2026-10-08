const { validationResult } = require('express-validator');
const User = require('../models/User.model');
const Person = require('../models/Person.model');
const { buildUniqueLogin } = require('../utils/login');
const { getUserCongregacoes, canAccessCongregacao } = require('../utils/access');
const { getTenant } = require('../tenancy/context');
const { DEFAULT_USER_PASSWORD } = require('../config/defaults');
const { signUserToken } = require('../utils/token');

// Admin só gerencia contas comuns (user) da própria congregação; demais papéis: apenas master.
const adminCannotManage = (req, target) => req.user.role !== 'master' && target.role !== 'user';

const list = async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const users = await User.find().populate('personId', 'congregacao').sort({ createdAt: -1 });
  const permitidas = await getUserCongregacoes(req.user);

  let visibleUsers = !permitidas
    ? users
    : users.filter((user) => permitidas.includes(user.personId?.congregacao));

  if (search) {
    const s = String(search).toLowerCase();
    visibleUsers = visibleUsers.filter(u => u.nome?.toLowerCase().includes(s) || u.login?.toLowerCase().includes(s));
  }

  const total = visibleUsers.length;
  const skip = (Number(page) - 1) * Number(limit);
  const paginated = visibleUsers.slice(skip, skip + Number(limit));

  res.json({
    items: paginated.map((user) => {
      const json = user.toJSON();
      return {
        ...json,
        congregacao: user.personId?.congregacao || '',
        congregacoesAcesso: user.congregacoesAcesso || [],
      };
    }),
    total,
    page: Number(page),
    limit: Number(limit)
  });
};

const createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { personId, role = 'user', login } = req.body;
  if (!['master', 'admin', 'user'].includes(role)) return res.status(400).json({ message: 'Papel inválido' });
  if (role !== 'user' && req.user.role !== 'master') {
    return res.status(403).json({ message: 'Apenas master pode criar administradores' });
  }

  const person = await Person.findById(personId);
  if (!person) return res.status(404).json({ message: 'Membro não encontrado' });
  if (req.user.role === 'admin') {
    if (!(await canAccessCongregacao(req.user, person.congregacao))) {
      return res.status(403).json({ message: 'Você só pode criar usuários da sua congregação' });
    }
  }

  const userLogin = login || (await buildUniqueLogin(person.nome));
  const existing = await User.findOne({ login: userLogin });
  if (existing) return res.status(409).json({ message: 'Login já existe' });

  const user = await User.create({
    nome: person.nome,
    login: userLogin,
    senha: DEFAULT_USER_PASSWORD,
    role,
    personId: person._id,
    ativo: true,
    mustChangePassword: true,
  });

  res.status(201).json(user.toJSON());
};

const updateRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { role } = req.body;
  if (role !== 'user' && req.user.role !== 'master') {
    return res.status(403).json({ message: 'Apenas master pode promover usuários' });
  }

  const target = await User.findById(req.params.id).populate('personId', 'congregacao');
  if (!target) return res.status(404).json({ message: 'Usuário não encontrado' });
  if (req.user.role !== 'master') {
    if (adminCannotManage(req, target)) {
      return res.status(403).json({ message: 'Apenas master pode alterar outro administrador' });
    }
    if (!(await canAccessCongregacao(req.user, target.personId?.congregacao))) {
      return res.status(403).json({ message: 'Você só pode alterar usuários da sua congregação' });
    }
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json(user.toJSON());
};

const updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { ativo } = req.body;
  const target = await User.findById(req.params.id).populate('personId', 'congregacao');
  if (!target) return res.status(404).json({ message: 'Usuário não encontrado' });
  if (req.user.role !== 'master') {
    if (adminCannotManage(req, target)) {
      return res.status(403).json({ message: 'Apenas master pode alterar outro administrador' });
    }
    if (!(await canAccessCongregacao(req.user, target.personId?.congregacao))) {
      return res.status(403).json({ message: 'Você só pode alterar usuários da sua congregação' });
    }
  }

  const user = await User.findByIdAndUpdate(req.params.id, { ativo }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json(user.toJSON());
};

const remove = async (req, res) => {
  const target = await User.findById(req.params.id).populate('personId', 'congregacao');
  if (!target) return res.status(404).json({ message: 'Usuário não encontrado' });
  if (req.user.role !== 'master') {
    if (adminCannotManage(req, target)) {
      return res.status(403).json({ message: 'Apenas master pode excluir outro administrador' });
    }
    if (!(await canAccessCongregacao(req.user, target.personId?.congregacao))) {
      return res.status(403).json({ message: 'Você só pode excluir usuários da sua congregação' });
    }
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json({ message: 'Usuário removido' });
};

const updateMyPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { senhaAtual, senhaNova } = req.body;
  const user = await User.findById(req.user.id).select('+senha');
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

  // Se não é primeiro login, exigir senha atual
  if (!user.mustChangePassword) {
    if (!senhaAtual) {
      return res.status(400).json({ message: 'Senha atual é obrigatória' });
    }
    const match = await user.comparePassword(senhaAtual);
    if (!match) {
      return res.status(401).json({ message: 'Senha atual incorreta' });
    }
  }

  if (typeof senhaNova !== 'string' || senhaNova.length < 6) {
    return res.status(400).json({ message: 'A nova senha deve ter ao menos 6 caracteres' });
  }
  if (senhaNova === DEFAULT_USER_PASSWORD) {
    return res.status(400).json({ message: 'Escolha uma senha diferente da senha padrão' });
  }

  user.senha = senhaNova;
  user.mustChangePassword = false;
  user.passwordChangedAt = new Date();
  await user.save(); // Dispara o pre-save do hash

  // Sessões anteriores à troca deixam de valer (auth.middleware); esta recebe um token novo.
  return res.json({ message: 'Senha atualizada com sucesso', token: signUserToken(user) });
};

const resetPassword = async (req, res) => {
  const target = await User.findById(req.params.id).populate('personId', 'congregacao');
  if (!target) return res.status(404).json({ message: 'Usuário não encontrado' });
  
  if (req.user.role !== 'master') {
    if (adminCannotManage(req, target)) {
      return res.status(403).json({ message: 'Apenas master pode resetar senha de outro administrador' });
    }
    if (!(await canAccessCongregacao(req.user, target.personId?.congregacao))) {
      return res.status(403).json({ message: 'Você só pode resetar senha de usuários da sua congregação' });
    }
  }

  target.senha = DEFAULT_USER_PASSWORD;
  target.mustChangePassword = true;
  target.passwordChangedAt = new Date(); // derruba as sessões abertas da conta resetada
  await target.save(); // Dispara o pre-save do hash

  return res.json({ message: 'Senha resetada para o padrão com sucesso' });
};

// Gestão de acesso (somente master): papel + congregações que o administrador gere.
// congregacoesAcesso vazio = só a congregação do próprio cadastro.
const updateAccess = async (req, res) => {
  if (req.user.role !== 'master') return res.status(403).json({ message: 'Apenas o master gerencia acessos' });
  const { role, congregacoesAcesso = [] } = req.body || {};
  if (role && !['master', 'admin', 'user'].includes(role)) return res.status(400).json({ message: 'Papel inválido' });
  const validas = getTenant()?.congregacoes || [];
  const lista = [...new Set((Array.isArray(congregacoesAcesso) ? congregacoesAcesso : []).filter((c) => validas.includes(c)))];
  if (String(req.params.id) === String(req.user._id) && role && role !== 'master') {
    return res.status(400).json({ message: 'Você não pode remover o seu próprio acesso master' });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { ...(role ? { role } : {}), congregacoesAcesso: role === 'admin' || (!role) ? lista : [] },
    { new: true },
  );
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json(user.toJSON());
};

module.exports = { list, createUser, updateRole, updateStatus, remove, updateMyPassword, resetPassword, updateAccess };
