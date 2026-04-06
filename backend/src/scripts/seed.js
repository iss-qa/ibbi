const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { parse } = require('csv-parse/sync');
const dotenv = require('dotenv');
const Person = require('../models/Person.model');
const User = require('../models/User.model');
const { buildUniqueLogin } = require('../utils/login');

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { DEFAULT_USER_PASSWORD, SEED_MASTER_PASSWORD } = require('../config/defaults');

const CSV_PATH = path.join(__dirname, '..', '..', '..', 'docs', 'churchcrm-export-20260315-222627.csv');

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

const createMasterUser = async () => {
  if (!SEED_MASTER_PASSWORD) {
    throw new Error('SEED_MASTER_PASSWORD não configurada no .env');
  }

  const exists = await User.findOne({ login: 'Isaias' });
  if (exists) return exists;

  const master = await User.create({
    nome: 'Isaias Santos Silva',
    login: 'Isaias',
    senha: SEED_MASTER_PASSWORD,
    role: 'master',
    ativo: true,
  });

  return master;
};

const ensureAdminUser = async () => {
  const login = 'elisa';
  const existing = await User.findOne({ login });
  if (existing) return existing;

  let person = await Person.findOne({ nome: 'Elisa Ribeiro' });
  if (!person) {
    person = await Person.create({
      nome: 'Elisa Ribeiro',
      tipo: 'membro',
      status: 'ativo',
    });
  }

  const admin = await User.create({
    nome: 'Elisa Ribeiro',
    login,
    senha: DEFAULT_USER_PASSWORD,
    role: 'admin',
    personId: person._id,
    ativo: true,
    mustChangePassword: true,
  });

  return admin;
};

const main = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI não configurada');
  }

  await mongoose.connect(process.env.MONGO_URI);

  await createMasterUser();
  await ensureAdminUser();

  if (!fs.existsSync(CSV_PATH)) {
    console.log('CSV não encontrado, pulando importação de membros.');
    await mongoose.disconnect();
    return;
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true,
  });

  let created = 0;
  let skipped = 0;

  for (const row of records) {
    const nome = buildFullName(row);
    const celular = normalizePhone(row['Celular']);

    if (!nome) {
      skipped += 1;
      continue;
    }

    const existing = await Person.findOne({ nome, celular });
    if (existing) {
      skipped += 1;
      continue;
    }

    const person = await Person.create({
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

    const generatedLogin = await buildUniqueLogin(nome);
    const loginExists = await User.findOne({ login: generatedLogin });
    if (!loginExists) {
      await User.create({
        nome,
        login: generatedLogin,
        senha: DEFAULT_USER_PASSWORD,
        role: 'user',
        personId: person._id,
        ativo: true,
        mustChangePassword: true,
      });
    }

    created += 1;
  }

  console.log(`Seed finalizado. Criados: ${created} | Ignorados: ${skipped}`);

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  mongoose.disconnect();
  process.exit(1);
});
