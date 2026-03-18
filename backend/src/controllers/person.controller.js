const { validationResult } = require('express-validator');
const { parse } = require('csv-parse/sync');
const Person = require('../models/Person.model');

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
  const filter = {};

  if (tipo) filter.tipo = tipo;
  if (grupo) filter.grupo = grupo;
  if (congregacao) filter.congregacao = congregacao;
  if (status) filter.status = status;
  if (batizado !== undefined) filter.batizado = batizado === 'true';

  if (search) {
    filter.$or = [
      { nome: new RegExp(search, 'i') },
      { tipo: new RegExp(search, 'i') },
      { grupo: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { celular: new RegExp(search, 'i') },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Person.find(filter).sort({ nome: 1 }).skip(skip).limit(Number(limit)),
    Person.countDocuments(filter),
  ]);

  return res.json({
    items,
    total,
    page: Number(page),
    limit: Number(limit),
  });
};

const getById = async (req, res) => {
  const person = await Person.findById(req.params.id);
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  return res.json(person);
};

const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const payload = { ...req.body };
  if (payload.celular) payload.celular = normalizePhone(payload.celular);
  if (payload.status !== 'inativo') delete payload.motivoInativacao;
  if (payload.motivoInativacao === '') delete payload.motivoInativacao;
  cleanEmptyEnums(payload);

  // Validação de duplicidade: Mesmo nome e celular
  if (payload.nome && payload.celular) {
    // Escapa caracteres especiais do regex e busca com case-insensitive
    const escapedNome = payload.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exists = await Person.findOne({ 
      nome: { $regex: new RegExp(`^${escapedNome}$`, 'i') }, 
      celular: payload.celular 
    });
    
    if (exists) {
      return res.status(400).json({ 
        message: `O membro "${payload.nome}" já possui um cadastro com o celular informado.` 
      });
    }
  }

  const person = await Person.create(payload);
  return res.status(201).json(person);
};

const update = async (req, res) => {
  const payload = { ...req.body };
  if (payload.celular) payload.celular = normalizePhone(payload.celular);
  if (payload.status !== 'inativo') delete payload.motivoInativacao;
  if (payload.motivoInativacao === '') delete payload.motivoInativacao;
  cleanEmptyEnums(payload);

  const person = await Person.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true,
  });
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
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

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  importCsv,
};
