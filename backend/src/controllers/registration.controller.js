const RegistrationRequest = require('../models/RegistrationRequest.model');
const Person = require('../models/Person.model');
const { onboardMember } = require('../services/member.service');
const { getUserCongregacao } = require('../utils/access');
const { escapeRegex } = require('../utils/sanitize');
const { applyPersonBusinessRules } = require('../utils/person-rules');

const sendError = (res, error) => res.status(error.status || 500).json({
  message: error.message || 'Erro interno no servidor',
});

const applyRegistrationScope = async (user, filter = {}) => {
  const scopedFilter = { ...filter };
  if (user?.role === 'master') {
    return { filter: scopedFilter, congregacao: null };
  }

  const congregacao = await getUserCongregacao(user);
  scopedFilter.congregacao = congregacao;
  return { filter: scopedFilter, congregacao };
};

const findScopedRequestById = async (user, id) => {
  const { filter, congregacao } = await applyRegistrationScope(user, { _id: id });
  const request = await RegistrationRequest.findOne(filter);
  return { request, congregacao };
};

const list = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const baseFilter = {};

    if (status) baseFilter.status = status;
    if (search) {
      baseFilter.nome = { $regex: new RegExp(escapeRegex(search), 'i') };
    }

    const { filter } = await applyRegistrationScope(req.user, baseFilter);

    const total = await RegistrationRequest.countDocuments(filter);
    const skip = (Number(page) - 1) * Number(limit);
    const items = await RegistrationRequest.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('reviewedBy', 'nome')
      .lean();

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    sendError(res, error);
  }
};

const getById = async (req, res) => {
  try {
    const { filter } = await applyRegistrationScope(req.user, { _id: req.params.id });
    const request = await RegistrationRequest.findOne(filter)
      .populate('reviewedBy', 'nome')
      .populate('approvedPersonId', 'nome celular')
      .lean();
    if (!request) return res.status(404).json({ message: 'Solicitação não encontrada' });
    res.json(request);
  } catch (error) {
    sendError(res, error);
  }
};

const approve = async (req, res) => {
  try {
    const { request, congregacao } = await findScopedRequestById(req.user, req.params.id);
    if (!request) return res.status(404).json({ message: 'Solicitação não encontrada' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Solicitação já foi ${request.status === 'approved' ? 'aprovada' : 'rejeitada'}` });
    }

    const body = req.body || {};
    const data = body.personData || request.submittedData || {};
    const personPayload = {
      ...data,
      nome: data.nome || request.nome,
      celular: data.celular || request.celular,
      congregacao: req.user.role === 'master' ? (data.congregacao || request.congregacao) : congregacao,
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
    request.reviewNote = body.reviewNote || '';
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
  } catch (error) {
    sendError(res, error);
  }
};

const reject = async (req, res) => {
  try {
    const { request } = await findScopedRequestById(req.user, req.params.id);
    if (!request) return res.status(404).json({ message: 'Solicitação não encontrada' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Solicitação já foi ${request.status === 'approved' ? 'aprovada' : 'rejeitada'}` });
    }

    const { reviewNote } = req.body || {};
    if (!reviewNote) {
      return res.status(400).json({ message: 'Motivo da rejeição é obrigatório' });
    }

    request.status = 'rejected';
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    request.reviewNote = reviewNote;
    await request.save();

    res.json({ message: 'Solicitação rejeitada' });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { list, getById, approve, reject };
