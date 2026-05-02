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
};
