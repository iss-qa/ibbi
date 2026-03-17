const { validationResult } = require('express-validator');
const User = require('../models/User.model');
const Person = require('../models/Person.model');

const list = async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map((u) => u.toJSON()));
};

const buildLogin = async (personName) => {
  const base = personName.split(' ')[0].toLowerCase();
  let login = base;
  let counter = 1;
  while (await User.findOne({ login })) {
    login = `${base}${counter}`;
    counter += 1;
  }
  return login;
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

  const userLogin = login || (await buildLogin(person.nome));
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

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json(user.toJSON());
};

const updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { ativo } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { ativo }, { new: true });
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json(user.toJSON());
};

const remove = async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
  return res.json({ message: 'Usuário removido' });
};

module.exports = { list, createUser, updateRole, updateStatus, remove };
