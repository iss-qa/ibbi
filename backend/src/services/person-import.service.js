const { parse } = require('csv-parse/sync');
const Person = require('../models/Person.model');
const { getTenant } = require('../tenancy/context');
const { applyPersonBusinessRules, parseDate } = require('../utils/person-rules');

// Importação de pessoas por CSV. Aceita o modelo do PastorIA (cabeçalhos abaixo) e
// apelidos comuns (export do ChurchCRM, planilhas em inglês). Cabeçalhos são casados
// sem acento, sem caixa e sem espaços — "Data de Nascimento" == "dataNascimento".

const MAX_ROWS = 5000;
const PREVIEW_ROWS = 500;

const TEMPLATE_HEADERS = [
  'nome', 'sexo', 'dataNascimento', 'email', 'celular', 'tipo', 'grupo', 'estadoCivil',
  'batizado', 'dataBatismo', 'congregacao', 'status', 'endereco', 'ministerio',
];

const HEADER_ALIASES = {
  nome: ['nome', 'nome completo', 'name', 'full name', 'pessoa'],
  segundoNome: ['segundo nome', 'middle name'],
  sobrenome: ['sobrenome', 'last name', 'surname'],
  sexo: ['sexo', 'genero', 'gender'],
  dataNascimento: ['datanascimento', 'data de nascimento', 'nascimento', 'data de aniversario', 'aniversario', 'birthday', 'birth date', 'date of birth'],
  email: ['email', 'e-mail', 'e mail'],
  celular: ['celular', 'whatsapp', 'telefone', 'telefone celular', 'phone', 'mobile', 'mobile phone', 'cell'],
  tipo: ['tipo', 'classificacao', 'classification', 'membership'],
  grupo: ['grupo', 'classe', 'classe ebd', 'group', 'faixa etaria'],
  estadoCivil: ['estadocivil', 'estado civil', 'marital status'],
  batizado: ['batizado', 'batizada', 'baptized'],
  dataBatismo: ['databatismo', 'data de batismo', 'data batismo', 'batismo', 'membershipdate', 'membership date', 'baptism date'],
  dataCasamento: ['datacasamento', 'data de casamento', 'casamento', 'wedding date', 'anniversary'],
  congregacao: ['congregacao', 'congregation', 'campus', 'igreja', 'unidade'],
  status: ['status', 'situacao', 'ativo'],
  motivoInativacao: ['motivoinativacao', 'motivo inativacao', 'motivo'],
  endereco: ['endereco', 'address', 'logradouro', 'rua'],
  complemento: ['complemento', 'address 2', 'complement'],
  bairro: ['bairro', 'neighborhood'],
  cidade: ['cidade', 'city'],
  estado: ['estado', 'uf', 'state'],
  cep: ['cep', 'zip', 'zip code', 'postal code'],
  ministerio: ['ministerio', 'ministry', 'ministerios'],
};

const TIPOS = ['membro', 'congregado', 'visitante', 'novo decidido', 'criança'];
const GRUPOS = ['criança', 'adolescente', 'jovem', 'adulto 1', 'adulto 2', 'idoso', 'ancião'];
const ESTADOS_CIVIS = ['solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'separado(a)', 'união estável'];
const MOTIVOS = ['falecimento', 'desvio doutrinário', 'mudança de endereço', 'desconhecido', 'outro'];

const fold = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const foldKey = (value) => fold(value).replace(/\s+/g, '');

const ALIAS_INDEX = Object.entries(HEADER_ALIASES).reduce((acc, [field, aliases]) => {
  aliases.forEach((a) => { acc[foldKey(a)] = field; });
  acc[foldKey(field)] = field;
  return acc;
}, {});

// Mapa cabeçalho-original → campo canônico. Detecta o padrão "Nome + Sobrenome" (ChurchCRM).
const mapHeaders = (headers) => {
  const map = {};
  headers.forEach((h) => {
    const field = ALIAS_INDEX[foldKey(h)];
    if (field && !Object.values(map).includes(field)) map[h] = field;
  });
  return map;
};

const pick = (row, headerMap, field) => {
  const header = Object.keys(headerMap).find((h) => headerMap[h] === field);
  const v = header ? row[header] : undefined;
  return v === undefined || v === null ? '' : String(v).trim();
};

const parseBool = (value) => {
  const v = fold(value);
  if (!v) return undefined;
  if (['sim', 's', 'true', '1', 'x', 'yes', 'y', 'batizado', 'batizada'].includes(v)) return true;
  if (['nao', 'n', 'false', '0', 'no', ''].includes(v)) return false;
  return undefined;
};

// Compara ignorando acento, caixa, espaços e flexão de gênero: "casada" == "casado(a)", "viuvo" == "viúvo(a)".
const stem = (value) => fold(String(value ?? '').replace(/\(a\)/gi, ''))
  .replace(/\s+/g, '')
  .replace(/ns$/, 'm') // jovens → jovem
  .replace(/s$/, '') // adolescentes → adolescente
  .replace(/[ao]$/, '');
const matchEnum = (value, options) => {
  const v = fold(value);
  if (!v) return undefined;
  return options.find((o) => fold(o) === v) || options.find((o) => stem(o) === stem(value));
};

const mapSexo = (value) => {
  const v = fold(value);
  if (!v) return undefined;
  if (v.startsWith('m') || v === 'h') return 'Masculino';
  if (v.startsWith('f') || v === 'w') return 'Feminino';
  return undefined;
};

const mapTipo = (value) => {
  const v = fold(value);
  if (!v) return undefined;
  if (v.includes('membro') || v === 'member') return 'membro';
  if (v.includes('congreg')) return 'congregado';
  if (v.includes('visit')) return 'visitante';
  if (v.includes('novo') || v.includes('decid')) return 'novo decidido';
  if (v.includes('crian') || v.includes('child')) return 'criança';
  return matchEnum(value, TIPOS);
};

const mapStatus = (value) => {
  const v = fold(value);
  if (!v) return undefined;
  if (['ativo', 'ativa', 'active', 'sim', 'true', '1'].includes(v)) return 'ativo';
  if (['inativo', 'inativa', 'inactive', 'nao', 'false', '0'].includes(v)) return 'inativo';
  return undefined;
};

const normalizePhone = (value) => {
  let d = String(value || '').replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  return d;
};

const mapCongregacao = (value, congregacoes) => {
  const v = fold(value);
  if (!v) return { value: undefined };
  const hit = congregacoes.find((c) => fold(c) === v) || congregacoes.find((c) => fold(c).includes(v) || v.includes(fold(c)));
  if (hit) return { value: hit };
  return { value: 'Não atribuído', aviso: `Congregação "${value}" não existe na igreja; ficou como "Não atribuído"` };
};

// Converte uma linha do CSV no payload do Person + avisos da linha.
const rowToPayload = (row, headerMap, congregacoes) => {
  const get = (f) => pick(row, headerMap, f);
  const avisos = [];

  const temSobrenome = Object.values(headerMap).includes('sobrenome');
  const nome = temSobrenome
    ? [get('nome'), get('segundoNome'), get('sobrenome')].filter(Boolean).join(' ')
    : get('nome');

  const payload = { nome: nome.replace(/\s+/g, ' ').trim() };

  const sexo = get('sexo');
  if (sexo) { payload.sexo = mapSexo(sexo); if (!payload.sexo) avisos.push(`Sexo "${sexo}" não reconhecido`); }

  const nasc = get('dataNascimento');
  if (nasc) { payload.dataNascimento = parseDate(nasc); if (!payload.dataNascimento) avisos.push(`Data de nascimento "${nasc}" inválida`); }

  const email = get('email');
  if (email) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) payload.email = email.toLowerCase();
    else avisos.push(`Email "${email}" inválido, ignorado`);
  }

  const cel = get('celular');
  if (cel) {
    payload.celular = normalizePhone(cel);
    if (payload.celular.length < 10 || payload.celular.length > 11) { avisos.push(`Celular "${cel}" fora do padrão DDD+número; mantido como digitado`); }
  }

  const tipo = get('tipo');
  if (tipo) { payload.tipo = mapTipo(tipo); if (!payload.tipo) avisos.push(`Tipo "${tipo}" não reconhecido`); }

  const grupo = get('grupo');
  if (grupo) { payload.grupo = matchEnum(grupo, GRUPOS); if (!payload.grupo) avisos.push(`Grupo "${grupo}" não reconhecido; será calculado pela idade`); }

  const ec = get('estadoCivil');
  if (ec) { payload.estadoCivil = matchEnum(ec, ESTADOS_CIVIS); if (!payload.estadoCivil) avisos.push(`Estado civil "${ec}" não reconhecido`); }

  const bat = get('batizado');
  if (bat) payload.batizado = parseBool(bat);
  const dBat = get('dataBatismo');
  if (dBat) { payload.dataBatismo = parseDate(dBat); if (!payload.dataBatismo) avisos.push(`Data de batismo "${dBat}" inválida`); }

  const dCas = get('dataCasamento');
  if (dCas) { payload.dataCasamento = parseDate(dCas); if (!payload.dataCasamento) avisos.push(`Data de casamento "${dCas}" inválida`); }

  const cong = mapCongregacao(get('congregacao'), congregacoes);
  if (cong.value) payload.congregacao = cong.value;
  if (cong.aviso) avisos.push(cong.aviso);

  const status = get('status');
  if (status) { payload.status = mapStatus(status); if (!payload.status) avisos.push(`Status "${status}" não reconhecido; ficou "ativo"`); }
  if (payload.status === 'inativo') {
    payload.motivoInativacao = matchEnum(get('motivoInativacao'), MOTIVOS) || 'desconhecido';
  }

  const endereco = [get('endereco'), get('complemento'), get('bairro'), get('cidade'), get('estado'), get('cep')].filter(Boolean).join(', ');
  if (endereco) payload.endereco = endereco;

  const ministerio = get('ministerio');
  if (ministerio) payload.ministerio = ministerio;

  Object.keys(payload).forEach((k) => { if (payload[k] === undefined || payload[k] === null || payload[k] === '') delete payload[k]; });
  applyPersonBusinessRules(payload);
  return { payload, avisos };
};

const parseCsv = (buffer) => {
  let raw = buffer.toString('utf-8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // BOM do Excel
  const delimiter = (raw.split('\n')[0].match(/;/g) || []).length > (raw.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  return parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true, trim: true, bom: true, delimiter });
};

// Prévia (dryRun) ou importação. `buildDuplicateQuery` vem do controller para manter a mesma regra do cadastro manual.
const importPeople = async (buffer, { dryRun = false, buildDuplicateQuery }) => {
  const records = parseCsv(buffer);
  if (!records.length) throw Object.assign(new Error('O arquivo está vazio ou sem cabeçalho'), { status: 400 });
  if (records.length > MAX_ROWS) throw Object.assign(new Error(`Máximo de ${MAX_ROWS} linhas por arquivo`), { status: 400 });

  const headers = Object.keys(records[0]);
  const headerMap = mapHeaders(headers);
  const reconhecidos = [...new Set(Object.values(headerMap))];
  if (!reconhecidos.includes('nome')) {
    throw Object.assign(new Error('Não encontrei a coluna "nome". Baixe o modelo para ver os cabeçalhos aceitos.'), { status: 400, headers });
  }
  const congregacoes = getTenant()?.congregacoes || [];

  const resumo = { total: records.length, criados: 0, ignorados: 0, erros: 0, avisos: 0 };
  const linhas = [];
  const vistos = new Set(); // duplicidade dentro do próprio arquivo

  for (let i = 0; i < records.length; i += 1) {
    const linha = i + 2; // 1 = cabeçalho
    const { payload, avisos } = rowToPayload(records[i], headerMap, congregacoes);
    const item = { linha, nome: payload.nome, celular: payload.celular, congregacao: payload.congregacao, tipo: payload.tipo, avisos };
    resumo.avisos += avisos.length;

    if (!payload.nome) {
      resumo.erros += 1;
      linhas.push({ ...item, resultado: 'erro', motivo: 'Nome vazio' });
      continue;
    }

    const chave = `${fold(payload.nome)}|${payload.celular || ''}`;
    if (vistos.has(chave)) {
      resumo.ignorados += 1;
      linhas.push({ ...item, resultado: 'ignorado', motivo: 'Repetido no próprio arquivo' });
      continue;
    }
    vistos.add(chave);

    const dupQuery = buildDuplicateQuery(payload);
    if (dupQuery && await Person.exists(dupQuery)) {
      resumo.ignorados += 1;
      linhas.push({ ...item, resultado: 'ignorado', motivo: 'Já cadastrado (nome + celular/nascimento/email)' });
      continue;
    }

    if (dryRun) {
      linhas.push({ ...item, resultado: 'ok' });
      resumo.criados += 1;
      continue;
    }

    try {
      await Person.create(payload);
      resumo.criados += 1;
      linhas.push({ ...item, resultado: 'criado' });
    } catch (err) {
      resumo.erros += 1;
      linhas.push({ ...item, resultado: 'erro', motivo: err.message });
    }
  }

  return {
    dryRun,
    resumo,
    colunas: { reconhecidas: reconhecidos, ignoradas: headers.filter((h) => !headerMap[h]) },
    linhas: linhas.slice(0, PREVIEW_ROWS),
    linhasOmitidas: Math.max(0, linhas.length - PREVIEW_ROWS),
  };
};

// Modelo CSV para download (BOM para o Excel abrir com acentos; separador vírgula).
const buildTemplate = () => {
  const cong = getTenant()?.congregacoes?.[0] || 'Sede';
  const rows = [
    TEMPLATE_HEADERS,
    ['Maria da Silva', 'Feminino', '15/03/1985', 'maria@email.com', '(71) 99999-1234', 'membro', '', 'casado(a)', 'sim', '20/11/2005', cong, 'ativo', 'Rua das Flores 10, Salvador, BA', 'Louvor'],
    ['João Pereira', 'Masculino', '02/08/2010', '', '71988887777', 'congregado', '', '', 'não', '', cong, 'ativo', '', ''],
  ];
  const esc = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  return `﻿${rows.map((r) => r.map(esc).join(',')).join('\n')}\n`;
};

module.exports = { importPeople, buildTemplate, TEMPLATE_HEADERS, HEADER_ALIASES, parseDate, rowToPayload, mapHeaders };
