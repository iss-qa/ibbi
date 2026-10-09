const coerceTruthy = (value) => value === true || value === 'true' || value === 1 || value === '1';

const LOWERCASE_NAME_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com']);

const normalizeName = (name) => {
  if (!name) return name;
  return String(name)
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((word, i) => {
      if (i > 0 && LOWERCASE_NAME_WORDS.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1);
    })
    .join(' ');
};

const calculateAge = (birthday) => {
  if (!birthday) return null;
  const date = birthday instanceof Date ? birthday : new Date(birthday);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  return age;
};

const determineGroup = (age) => {
  if (age === null || Number.isNaN(age)) return '';
  if (age <= 9) return 'criança';
  if (age <= 17) return 'adolescente';
  if (age <= 35) return 'jovem';
  if (age <= 50) return 'adulto 1';
  if (age <= 60) return 'adulto 2';
  if (age <= 75) return 'idoso';
  return 'ancião';
};

const determineGroupFromBirthDate = (birthday) => determineGroup(calculateAge(birthday));

// Datas digitadas: ISO (aaaa-mm-dd…), dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa e aaaa/mm/dd.
// Retorna Date (UTC) ou null para data impossível (31/02, mês 13) ou fora de 1900–2100.
const toDate = (y, mo, d) => {
  const year = Number(y);
  if (year < 1900 || year > 2100) return null;
  const date = new Date(Date.UTC(year, Number(mo) - 1, Number(d)));
  return Number.isNaN(date.getTime()) || date.getUTCMonth() !== Number(mo) - 1 ? null : date;
};
const parseDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return toDate(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return toDate(m[3].length === 2 ? `19${m[3]}` : m[3], m[2], m[1]);
  return null; // sem fallback para new Date(): ele aceita "12/05/" como 05/12/2001
};

const PERSON_DATE_FIELDS = {
  dataNascimento: 'Data de nascimento',
  dataBatismo: 'Data de batismo',
  dataCasamento: 'Data de casamento',
  dataVisita: 'Data da visita',
  dataDecisao: 'Data da decisão',
};

// Normaliza as datas do cadastro para aaaa-mm-dd. Vazio continua vazio (o update usa '' para limpar);
// data que não dá para entender é removida do payload. Retorna os rótulos das que foram removidas.
const normalizePersonDates = (target) => {
  const invalidas = [];
  if (!target || typeof target !== 'object') return invalidas;
  Object.entries(PERSON_DATE_FIELDS).forEach(([field, label]) => {
    const value = target[field];
    if (value === undefined || value === null || value === '') return;
    const date = parseDate(value);
    if (date) {
      target[field] = date.toISOString().slice(0, 10);
    } else {
      delete target[field];
      invalidas.push(label);
    }
  });
  return invalidas;
};

const applyPersonBusinessRules = (target) => {
  if (!target || typeof target !== 'object') return target;

  if (typeof target.nome === 'string' && target.nome.trim()) {
    target.nome = normalizeName(target.nome);
  }
  if (typeof target.acompanhadoNome === 'string' && target.acompanhadoNome.trim()) {
    target.acompanhadoNome = normalizeName(target.acompanhadoNome);
  }

  if (target.dataNascimento) {
    const autoGroup = determineGroupFromBirthDate(target.dataNascimento);
    if (autoGroup && !target.grupo) {
      target.grupo = autoGroup;
    }
  }

  const hasBaptismDate = Boolean(target.dataBatismo);
  const isBaptized = coerceTruthy(target.batizado) || hasBaptismDate;

  if (isBaptized) {
    target.batizado = true;
    target.tipo = 'membro';
  } else if (target.tipo === 'congregado') {
    target.batizado = false;
    delete target.dataBatismo;
  }

  return target;
};

module.exports = {
  applyPersonBusinessRules,
  calculateAge,
  determineGroup,
  determineGroupFromBirthDate,
  normalizeName,
  normalizePersonDates,
  parseDate,
};
