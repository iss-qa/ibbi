const { validationResult } = require('express-validator');
const User = require('../models/User.model');
const Person = require('../models/Person.model');
const { buildUniqueLogin } = require('../utils/login');
const { getUserCongregacao } = require('../utils/access');

const list = async (req, res) => {
  const users = await User.find().populate('personId', 'congregacao').sort({ createdAt: -1 });
  const userCongregacao = req.user.role === 'admin' ? await getUserCongregacao(req.user) : null;
  const visibleUsers = req.user.role === 'master'
    ? users
    : users.filter((user) => user.personId?.congregacao === userCongregacao);

  res.json(visibleUsers.map((user) => {
    const json = user.toJSON();
    return {
      ...json,
      congregacao: user.personId?.congregacao || '',
    };
  }));
};

const createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { personId, role = 'user', login } = req.body;
  if (role === 'master' && req.user.role !== 'master') {
    return res.status(403).json({ message: 'Apenas master pode criar master' });
  }

  const person = await Person.findById(personId);
  if (!person) return res.status(404).json({ message: 'Membro não encontrado' });
  if (req.user.role === 'admin') {
    const userCongregacao = await getUserCongregacao(req.user);
    if (person.congregacao !== userCongregacao) {
      return res.status(403).json({ message: 'Você só pode criar usuários da sua congregação' });
    }
  }

  const userLogin = login || (await buildUniqueLogin(person.nome));
  const existing = await User.findOne({ login: userLogin });
  if (existing) return res.status(409).json({ message: 'Login já existe' });

  const user = await User.create({
    nome: person.nome,
    login: userLogin,
    senha: 'IBBI2026',
    role,
    personId: person._id,
    ativo: true,
  });

  res.status(201).json(user.toJSON());
};

const updateRole = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { role } = req.body;
  if (role === 'master' && req.user.role !== 'master') {
    return res.status(403).json({ message: 'Apenas master pode promover master' });
  }

  const target = await User.findById(req.params.id).populate('personId', 'congregacao');
  if (!target) return res.status(404).json({ message: 'Usuário não encontrado' });
  if (req.user.role !== 'master') {
    if (target.role === 'master') {
      return res.status(403).json({ message: 'Apenas master pode alterar outro master' });
    }
    const userCongregacao = await getUserCongregacao(req.user);
    if (target.personId?.congregacao !== userCongregacao) {
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
    if (target.role === 'master') {
      return res.status(403).json({ message: 'Apenas master pode alterar outro master' });
    }
    const userCongregacao = await getUserCongregacao(req.user);
    if (target.personId?.congregacao !== userCongregacao) {
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
    if (target.role === 'master') {
      return res.status(403).json({ message: 'Apenas master pode excluir outro master' });
    }
    const userCongregacao = await getUserCongregacao(req.user);
    if (target.personId?.congregacao !== userCongregacao) {
      return res.status(403).json({ message: 'Você só pode excluir usuários da sua congregação' });
    }
  }

  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json({ message: 'Usuário removido' });
};

module.exports = { list, createUser, updateRole, updateStatus, remove };
