// Reusable test data generators
const timestamp = () => Date.now().toString(36);

// All test messages go to this number instead of real members
const MOCK_PHONE = process.env.ALERT_PHONE || '5571996838735';

const newMember = (overrides = {}) => ({
  nome: `Teste Automatizado ${timestamp()}`,
  tipo: 'congregado',
  sexo: 'Masculino',
  congregacao: 'Sede',
  celular: `71999${Math.floor(100000 + Math.random() * 899999)}`,
  dataNascimento: '1990-05-15',
  estadoCivil: 'solteiro(a)',
  email: `teste_${timestamp()}@test.com`,
  status: 'ativo',
  ...overrides,
});

const newVisitante = (overrides = {}) => ({
  ...newMember({ tipo: 'visitante', dataVisita: new Date().toISOString().split('T')[0] }),
  ...overrides,
});

const newNovoDecidido = (overrides = {}) => ({
  ...newMember({ tipo: 'novo decidido', dataDecisao: new Date().toISOString().split('T')[0] }),
  ...overrides,
});

module.exports = { newMember, newVisitante, newNovoDecidido, timestamp, MOCK_PHONE };
