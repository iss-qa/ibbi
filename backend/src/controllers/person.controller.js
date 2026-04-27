const { validationResult } = require('express-validator');
const { parse } = require('csv-parse/sync');
const Person = require('../models/Person.model');
const User = require('../models/User.model');
const Message = require('../models/Message.model');
const { onboardMember } = require('../services/member.service');
const whatsapp = require('../services/whatsapp.service');
const { applyScopedCongregacaoFilter, assertPersonAccess, getUserCongregacao } = require('../utils/access');
const { escapeRegex } = require('../utils/sanitize');
const { applyPersonBusinessRules } = require('../utils/person-rules');

const normalizePhone = (value) => (value ? String(value).replace(/\D/g, '') : '');

const buildFullName = (row) => {
  const nome = row['Nome'] || '';
  const segundo = row['Segundo Nome'] || '';
  const sobrenome = row['Sobrenome'] || '';
  return [nome, segundo, sobrenome].filter(Boolean).join(' ').trim();
};

const buildEndereco = (row) => {
  const parts = [
    row['Endereço'],
    row['Complemento'],
    row['Cidade'],
    row['Estado'],
    row['CEP'],
  ].filter(Boolean);
  return parts.join(', ');
};

const mapSexo = (value) => {
  if (!value) return undefined;
  const v = String(value).toLowerCase();
  if (v.startsWith('m')) return 'Masculino';
  if (v.startsWith('f')) return 'Feminino';
  return undefined;
};

const mapTipo = (value) => {
  if (!value) return undefined;
  const v = String(value).toLowerCase();
  if (v.includes('membro')) return 'membro';
  if (v.includes('congreg')) return 'congregado';
  if (v.includes('visit')) return 'visitante';
  if (v.includes('novo')) return 'novo decidido';
  if (v.includes('crian')) return 'criança';
  return undefined;
};

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
const ALLOWED_FIELDS_USER = ['nome', 'celular', 'email', 'sexo', 'dataNascimento', 'estadoCivil', 'endereco', 'fotoUrl'];
const ALLOWED_FIELDS_ADMIN = [
  'nome', 'celular', 'email', 'sexo', 'dataNascimento', 'estadoCivil', 'endereco', 'fotoUrl',
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

const LOWERCASE_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com']);

const normalizeName = (name) => {
  if (!name) return name;
  return String(name)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

const mapEstadoCivil = (value) => {
  if (!value) return undefined;
  const v = String(value).toLowerCase().replace(/\s+/g, ' ').trim();
  const map = {
    'solteiro (a)': 'solteiro(a)',
    'casado (a)': 'casado(a)',
    'divorciado (a)': 'divorciado(a)',
    'viúvo (a)': 'viúvo(a)',
    'separado (a)': 'separado(a)',
    'união estável': 'união estável',
    'uniao estavel': 'união estável',
  };
  return map[v] || value;
};

const mapCongregacao = (value) => {
  if (!value) return undefined;
  const v = String(value).trim().toUpperCase();
  const map = {
    'SEDE': 'Sede',
    'SÃO CRISTOVÃO': 'São Cristóvão',
    'SÃO CRISTÓVÃO': 'São Cristóvão',
    'VIDA NOVA': 'Vida Nova',
    'PQ SÃO PAULO 1': 'PQ São Paulo 1',
    'PQ SÃO PAULO 2': 'PQ São Paulo 2',
    'CAPELÃO': 'Capelão',
    'BAIRRO DA PAZ': 'Bairro da Paz',
    'DONA LINDU': 'Dona Lindu',
    'PORTÃO': 'Portão',
    'OLINDINA-BA': 'Olindina-BA',
    'CRISÓPOLIS-BA': 'Crisópolis-BA',
    'SÃO FELIPE-BA': 'São Felipe-BA',
    'SÃO SEBASTIÃO DO PASSÉ - BA': 'São Sebastião do Passé - BA',
    'NÃO ATRIBUÍDO': 'Não atribuído',
  };
  return map[v] || value;
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
    payload.congregacao = await getUserCongregacao(req.user);
  }

  // Validação de duplicidade: nome + celular OU nome + dataNascimento
  if (payload.nome) {
    const escapedNome = payload.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nomeRegex = { $regex: new RegExp(`^${escapedNome}$`, 'i') };
    const orConditions = [];

    if (payload.celular) {
      orConditions.push({ nome: nomeRegex, celular: payload.celular });
    }
    if (payload.dataNascimento) {
      orConditions.push({ nome: nomeRegex, dataNascimento: new Date(payload.dataNascimento) });
    }

    if (orConditions.length > 0) {
      const exists = await Person.findOne({ $or: orConditions });
      if (exists) {
        return res.status(409).json({
          code: 'DUPLICATE',
          message: `O cadastro de "${payload.nome}" já foi realizado anteriormente. Caso precise atualizar seus dados, entre em contato com a secretaria da igreja.`,
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
    payload.congregacao = await getUserCongregacao(req.user);
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

const importCsv = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo CSV não enviado' });

  const raw = req.file.buffer.toString('utf-8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });

  const created = [];
  const skipped = [];

  for (const row of records) {
    const nome = buildFullName(row);
    const celular = normalizePhone(row['Celular']);

    if (!nome) {
      skipped.push({ row, motivo: 'Nome vazio' });
      continue;
    }

    const exists = await Person.findOne({ nome, celular });
    if (exists) {
      skipped.push({ row, motivo: 'Já existe' });
      continue;
    }

    const pessoa = await Person.create({
      nome,
      sexo: mapSexo(row['Gênero']),
      dataNascimento: row['Data de Aniversário'] ? new Date(row['Data de Aniversário']) : undefined,
      email: row['E-mail'] || undefined,
      celular,
      tipo: mapTipo(row['Classificação']) || 'congregado',
      grupo: row['Grupo'] || undefined,
      estadoCivil: mapEstadoCivil(row['Estado Civil']),
      batizado: Boolean(row['MembershipDate']),
      dataBatismo: row['MembershipDate'] ? new Date(row['MembershipDate']) : undefined,
      congregacao: mapCongregacao(row['Congregação']),
      status: 'ativo',
      endereco: buildEndereco(row),
      ministerio: row['Ministério'] || undefined,
    });

    created.push(pessoa);
  }

  return res.json({ created: created.length, skipped: skipped.length, skippedDetails: skipped });
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

  const person = await Person.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, runValidators: true }
  );
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  return res.json(person);
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  importCsv,
  updateHealth,
};
