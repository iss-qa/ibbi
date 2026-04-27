const RegistrationRequest = require('../models/RegistrationRequest.model');
const Person = require('../models/Person.model');
const { onboardMember } = require('../services/member.service');
const { getUserCongregacao } = require('../utils/access');
const { escapeRegex } = require('../utils/sanitize');
const { applyPersonBusinessRules } = require('../utils/person-rules');

const list = async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (status) filter.status = status;
  if (search) {
    filter.nome = { $regex: new RegExp(escapeRegex(search), 'i') };
  }

  const total = await RegistrationRequest.countDocuments(filter);
  const skip = (Number(page) - 1) * Number(limit);
  const items = await RegistrationRequest.find(filter)
    .sort({ submittedAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate('reviewedBy', 'nome')
    .lean();

  res.json({ items, total, page: Number(page), limit: Number(limit) });
};

const getById = async (req, res) => {
  const request = await RegistrationRequest.findById(req.params.id)
    .populate('reviewedBy', 'nome')
    .populate('approvedPersonId', 'nome celular')
    .lean();
  if (!request) return res.status(404).json({ message: 'Solicitação não encontrada' });
  res.json(request);
};

const approve = async (req, res) => {
  const request = await RegistrationRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Solicitação não encontrada' });
  if (request.status !== 'pending') {
    return res.status(400).json({ message: `Solicitação já foi ${request.status === 'approved' ? 'aprovada' : 'rejeitada'}` });
  }

  const data = req.body.personData || request.submittedData || {};
  // Usar nome/celular/congregação do request, permitindo override via body
  const personPayload = {
    ...data,
    nome: data.nome || request.nome,
    celular: data.celular || request.celular,
    congregacao: data.congregacao || request.congregacao,
    fotoUrl: data.fotoUrl || request.fotoUrl,
    status: 'ativo',
  };

  // Limpar campos vazios
  Object.keys(personPayload).forEach((key) => {
    if (personPayload[key] === '' || personPayload[key] === undefined) delete personPayload[key];
  });
  applyPersonBusinessRules(personPayload);

  const person = await Person.create(personPayload);
  const credentials = await onboardMember(person, req.user._id, { context: 'approval' });

  request.status = 'approved';
  request.reviewedAt = new Date();
  request.reviewedBy = req.user._id;
  request.reviewNote = req.body.reviewNote || '';
  request.approvedPersonId = person._id;
  if (credentials) {
    request.approvedUserId = (await require('../models/User.model').findOne({ personId: person._id }))?._id;
  }
  await request.save();

  res.json({
    message: 'Solicitação aprovada com sucesso',
    person: person.toJSON(),
    credentials: credentials ? { login: credentials.login } : null,
  });
};

const reject = async (req, res) => {
  const request = await RegistrationRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Solicitação não encontrada' });
  if (request.status !== 'pending') {
    return res.status(400).json({ message: `Solicitação já foi ${request.status === 'approved' ? 'aprovada' : 'rejeitada'}` });
  }

  const { reviewNote } = req.body;
  if (!reviewNote) {
    return res.status(400).json({ message: 'Motivo da rejeição é obrigatório' });
  }

  request.status = 'rejected';
  request.reviewedAt = new Date();
  request.reviewedBy = req.user._id;
  request.reviewNote = reviewNote;
  await request.save();

  res.json({ message: 'Solicitação rejeitada' });
};

module.exports = { list, getById, approve, reject };
