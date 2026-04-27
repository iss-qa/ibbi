export const PERSON_TYPE_OPTIONS = [
  {
    value: 'congregado',
    label: 'CONGREGADO',
    description: 'Pessoa que frequenta a igreja com regularidade, está em comunhão, mas ainda não desceu às águas. Pode caminhar com a comunidade enquanto amadurece para a membresia plena.',
  },
  {
    value: 'membro',
    label: 'MEMBRO',
    description: 'Pessoa batizada nas águas e recebida como parte da membresia. Pode participar da Santa Ceia, servir na liderança e assumir funções conforme a orientação da igreja.',
  },
  {
    value: 'visitante',
    label: 'VISITANTE',
    description: 'Pessoa em visita à igreja, cristã ou não, que ainda está conhecendo a comunidade, sua mensagem e sua forma de caminhar.',
  },
  {
    value: 'novo decidido',
    label: 'NOVO DECIDIDO',
    description: 'Pessoa que assumiu publicamente sua decisão por Cristo e inicia agora um caminho de acompanhamento, discipulado e integração à vida da igreja.',
  },
  {
    value: 'criança',
    label: 'CRIANÇA',
    description: 'Dependente vinculado à família, acompanhado pelos pais ou responsáveis no processo de integração à comunidade.',
  },
];

export const calculateAge = (birthday) => {
  if (!birthday) return null;
  const birthDate = birthday instanceof Date ? birthday : new Date(`${birthday}T12:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

export const determineGroup = (age) => {
  if (age === null || Number.isNaN(age)) return '';
  if (age <= 9) return 'criança';
  if (age <= 17) return 'adolescente';
  if (age <= 35) return 'jovem';
  if (age <= 50) return 'adulto 1';
  if (age <= 60) return 'adulto 2';
  if (age <= 75) return 'idoso';
  return 'ancião';
};

export const determineGroupFromBirthDate = (birthday) => determineGroup(calculateAge(birthday));
