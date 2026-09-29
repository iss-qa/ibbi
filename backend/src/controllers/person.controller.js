const { validationResult } = require('express-validator');
const { parse } = require('csv-parse/sync');
const Person = require('../models/Person.model');
const User = require('../models/User.model');
const Message = require('../models/Message.model');
const { onboardMember } = require('../services/member.service');
const whatsapp = require('../services/whatsapp.service');
const { applyScopedCongregacaoFilter, assertPersonAccess, getUserCongregacao, resolveWritableCongregacao } = require('../utils/access');
const { escapeRegex } = require('../utils/sanitize');
const { applyPersonBusinessRules, normalizeName } = require('../utils/person-rules');
const { importPeople, buildTemplate } = require('../services/person-import.service');

const normalizePhone = (value) => (value ? String(value).replace(/\D/g, '') : '');

const cleanEmptyEnums = (payload) => {
  const enumFields = ['sexo', 'tipo', 'grupo', 'estadoCivil', 'congregacao', 'status', 'motivoInativacao'];
  enumFields.forEach((field) => {
    if (payload[field] === '') delete payload[field];
  });
};

const clearFieldsByTipo = (payload) => {
  if (payload.tipo === 'visitante' || payload.tipo === 'novo decidido') {
    delete payload.email;
    delete payload.estadoCivil;
    delete payload.endereco;
    delete payload.ministerio;
    delete payload.batizado;
    delete payload.dataBatismo;
    delete payload.dataCasamento;
    delete payload.status;
    delete payload.motivoInativacao;
  }

  if (payload.tipo === 'visitante') {
    delete payload.dataDecisao;
  }

  if (payload.tipo === 'novo decidido') {
    delete payload.dataVisita;
  }

  if (payload.tipo !== 'visitante' && payload.tipo !== 'novo decidido') {
    delete payload.dataVisita;
    delete payload.dataDecisao;
  }
};

// Allowlists de campos por role para prevenir mass assignment
const ALLOWED_FIELDS_USER = ['nome', 'celular', 'email', 'sexo', 'dataNascimento', 'estadoCivil', 'dataCasamento', 'endereco', 'fotoUrl'];
const ALLOWED_FIELDS_ADMIN = [
  'nome', 'celular', 'email', 'sexo', 'dataNascimento', 'estadoCivil', 'dataCasamento', 'endereco', 'fotoUrl',
  'tipo', 'grupo', 'batizado', 'dataBatismo', 'status', 'motivoInativacao', 'ministerio',
  'dataVisita', 'dataDecisao', 'acompanhadoPersonId',
];
// master pode editar tudo — não precisa de allowlist

const filterByAllowlist = (payload, allowlist) => {
  const filtered = {};
  for (const key of allowlist) {
    if (payload[key] !== undefined) filtered[key] = payload[key];
  }
  return filtered;
};

const sanitizeFotoUrl = (url) => {
  if (!url) return url;
  // Aceitar apenas data: URIs (uploads controlados) ou paths relativos do /uploads/
  if (url.startsWith('data:image/') || url.startsWith('/uploads/')) return url;
  return undefined; // Rejeitar URLs externas (previne SSRF)
};

const buildDuplicateQuery = (payload) => {
  const orConditions = [];
  
  const nomeCompleto = payload.nome ? payload.nome.trim() : '';
  const nameParts = nomeCompleto.split(/\s+/);
  
  let nomeRegex;
  let nomePrimeiroUltimoRegex;
  
  if (nomeCompleto) {
    const escapedNome = nomeCompleto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    nomeRegex = new RegExp(`^${escapedNome}$`, 'i');
    
    if (nameParts.length > 1) {
      const primeiro = nameParts[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ultimo = nameParts[nameParts.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      nomePrimeiroUltimoRegex = new RegExp(`^${primeiro}.*${ultimo}$`, 'i');
    } else {
      nomePrimeiroUltimoRegex = nomeRegex;
    }
  }

  // 1. Nome aproximado + Celular
  if (nomePrimeiroUltimoRegex && payload.celular) {
    orConditions.push({ nome: { $regex: nomePrimeiroUltimoRegex }, celular: payload.celular });
  }

  // 2. Nome aproximado + Data Nascimento
  if (nomePrimeiroUltimoRegex && payload.dataNascimento) {
    orConditions.push({ nome: { $regex: nomePrimeiroUltimoRegex }, dataNascimento: new Date(payload.dataNascimento) });
  }

  // 3. Nome aproximado + Email
  if (nomePrimeiroUltimoRegex && payload.email) {
    orConditions.push({ nome: { $regex: nomePrimeiroUltimoRegex }, email: payload.email });
  }

  // 4. Data Nascimento + Celular
  if (payload.dataNascimento && payload.celular) {
    orConditions.push({ dataNascimento: new Date(payload.dataNascimento), celular: payload.celular });
  }

  // 5. Nome exato + Congregação
  if (nomeRegex && payload.congregacao && payload.congregacao !== 'Não atribuído') {
    orConditions.push({ nome: nomeRegex, congregacao: payload.congregacao });
  }
  
  return orConditions.length > 0 ? { $or: orConditions } : null;
};

const list = async (req, res) => {
  const { page = 1, limit = 20, search, tipo, grupo, congregacao, status, batizado } = req.query;
  let filter = {};

  if (tipo) filter.tipo = tipo;
  if (grupo) filter.grupo = grupo;
  if (status) filter.status = status;
  if (batizado !== undefined) filter.batizado = batizado === 'true';

  if (search) {
    const safe = escapeRegex(search);
    filter.$or = [
      { nome: new RegExp(safe, 'i') },
      { tipo: new RegExp(safe, 'i') },
      { grupo: new RegExp(safe, 'i') },
      { email: new RegExp(safe, 'i') },
      { celular: new RegExp(safe, 'i') },
    ];
  }

  filter = await applyScopedCongregacaoFilter(req.user, filter, congregacao);

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total, ativos, inativos] = await Promise.all([
    Person.find(filter).sort({ nome: 1 }).skip(skip).limit(Number(limit)),
    Person.countDocuments(filter),
    Person.countDocuments({ ...filter, status: 'ativo' }),
    Person.countDocuments({ ...filter, status: 'inativo' }),
  ]);

  return res.json({
    items,
    total,
    ativos,
    inativos,
    page: Number(page),
    limit: Number(limit),
  });
};

const getById = async (req, res) => {
  const person = await Person.findById(req.params.id);
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  await assertPersonAccess(req.user, person);

  const responseData = person.toJSON();

  if (req.user.role === 'master' || req.user.role === 'admin') {
    const linkedUser = await User.findOne({ personId: person._id });
    if (linkedUser) {
      responseData.userCredentials = { login: linkedUser.login };
    }
  }

  return res.json(responseData);
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const payload = req.user.role === 'admin' ? filterByAllowlist(req.body, [...ALLOWED_FIELDS_ADMIN, 'congregacao']) : { ...req.body };
  if (payload.nome) payload.nome = normalizeName(payload.nome);
  if (payload.celular) payload.celular = normalizePhone(payload.celular);
  if (payload.status !== 'inativo') delete payload.motivoInativacao;
  if (payload.motivoInativacao === '') delete payload.motivoInativacao;
  cleanEmptyEnums(payload);
  clearFieldsByTipo(payload);
  applyPersonBusinessRules(payload);
  if (payload.fotoUrl !== undefined) payload.fotoUrl = sanitizeFotoUrl(payload.fotoUrl);
  if (req.user.role === 'admin') {
    payload.congregacao = await resolveWritableCongregacao(req.user, payload.congregacao);
  }

  // Nova Validação de duplicidade forte
  if (payload.nome) {
    const duplicateQuery = buildDuplicateQuery(payload);
    if (duplicateQuery) {
      const exists = await Person.findOne(duplicateQuery);
      if (exists) {
        return res.status(409).json({
          code: 'DUPLICATE',
          message: `Um cadastro semelhante (mesmo nome, celular, data de nascimento, email ou congregação) já foi detectado para "${payload.nome}". Caso precise atualizar os dados, entre em contato com a secretaria da igreja.`,
        });
      }
    }
  }

  const person = await Person.create(payload);

  // Trigger WhatsApp para novo decidido ou visitante
  if (person.tipo === 'novo decidido') {
    const { triggerNovoDecididoWhatsApp } = require('../services/trigger.service');
    triggerNovoDecididoWhatsApp(person, req.user._id);
  } else if (person.tipo === 'visitante') {
    const { triggerVisitanteWhatsApp } = require('../services/trigger.service');
    triggerVisitanteWhatsApp(person, req.user._id);
  }

  if (person.celular) {
    const credentials = await onboardMember(person, req.user._id);
    if (credentials) {
      return res.status(201).json({
        ...person.toJSON(),
        generatedUser: {
          login: credentials.login,
        }
      });
    }
  }

  return res.status(201).json(person);
};

const update = async (req, res) => {
  const existing = await Person.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Pessoa não encontrada' });
  await assertPersonAccess(req.user, existing);

  let payload;
  if (req.user.role === 'user') {
    payload = filterByAllowlist(req.body, ALLOWED_FIELDS_USER);
  } else if (req.user.role === 'admin') {
    payload = filterByAllowlist(req.body, ALLOWED_FIELDS_ADMIN);
  } else {
    payload = { ...req.body };
  }

  if (payload.nome) payload.nome = normalizeName(payload.nome);
  if (payload.celular) payload.celular = normalizePhone(payload.celular);
  if (payload.status !== 'inativo') delete payload.motivoInativacao;
  if (payload.motivoInativacao === '') delete payload.motivoInativacao;
  cleanEmptyEnums(payload);
  clearFieldsByTipo(payload);
  applyPersonBusinessRules(payload);
  if (payload.fotoUrl !== undefined) payload.fotoUrl = sanitizeFotoUrl(payload.fotoUrl);
  if (req.user.role === 'admin') {
    payload.congregacao = await resolveWritableCongregacao(req.user, payload.congregacao || existing.congregacao);
  }

  const person = await Person.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  return res.json(person);
};

const remove = async (req, res) => {
  const person = await Person.findByIdAndDelete(req.params.id);
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  return res.json({ message: 'Pessoa removida' });
};

// Importação por CSV (modelo do PastorIA ou export do ChurchCRM). ?dryRun=1 só valida e devolve a prévia.
const importCsv = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo CSV não enviado' });
  const dryRun = ['1', 'true'].includes(String(req.query.dryRun || ''));
  try {
    const result = await importPeople(req.file.buffer, { dryRun, buildDuplicateQuery });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message, colunas: err.headers });
    throw err;
  }
};

const importTemplate = (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-pessoas.csv"');
  return res.send(buildTemplate());
};

const updateHealth = async (req, res) => {
  const allowed = ['tipoSanguineo', 'fatorRh', 'alergias', 'contatoEmergenciaNome', 'contatoEmergenciaTel'];
  const enumFields = ['tipoSanguineo', 'fatorRh'];
  const setFields = {};
  const unsetFields = {};

  allowed.forEach((key) => {
    if (req.body[key] === undefined) return;
    // Empty strings on enum fields must be unset, not set to ''
    if (enumFields.includes(key) && req.body[key] === '') {
      unsetFields[key] = '';
    } else {
      setFields[key] = req.body[key];
    }
  });

  const update = {};
  if (Object.keys(setFields).length) update.$set = setFields;
  if (Object.keys(unsetFields).length) update.$unset = unsetFields;

  if (!Object.keys(update).length) {
    return res.status(400).json({ message: 'Nenhum dado enviado' });
  }

  const existing = await Person.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Pessoa não encontrada' });

  await assertPersonAccess(req.user, existing);

  const person = await Person.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, runValidators: true }
  );

  return res.json(person);
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  importCsv,
  importTemplate,
  updateHealth,
  buildDuplicateQuery,
};
