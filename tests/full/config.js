// Configuração única da suíte completa (tests/full). Tudo isolado: banco próprio, WhatsApp falso,
// sem IA, sem email, sem gateway. Nada aqui toca o banco de desenvolvimento nem números reais.
const PORTAS = { mock: 3199, api: 3191, web: 4191 };

const E2E = {
  portas: PORTAS,
  apiUrl: `http://localhost:${PORTAS.api}/api`,
  webUrl: `http://localhost:${PORTAS.web}`,
  mockUrl: `http://127.0.0.1:${PORTAS.mock}`,
  banco: 'mongodb://localhost:27017/pastoria_e2e',
  senha: 'Senha@E2e123',
  webhookToken: 'tok-e2e-igreja',
  igrejas: { a: 'igreja-e2e', b: 'igreja-b-e2e', semente: 'igreja-semente-e2e' },
  // Telefones claramente fictícios (000…); 55 + 11 dígitos no formato do WhatsApp
  fones: {
    lider: '00000000010', admin: '00000000011', membro: '00000000012', visitante: '00000000013',
    voluntario: '00000000014', substituto: '00000000015', desconhecido: '00000000099', bot: '00000000001', igreja: '00000000002',
  },
};

// Ambiente do backend de teste. Toda variável do .env real que não estiver aqui é ZERADA
// (ver start-backend.js), para não usar SMTP, IA, Woovi ou WhatsApp de verdade por engano.
E2E.backendEnv = {
  NODE_ENV: 'test',
  PORT: String(PORTAS.api),
  MONGO_URI: E2E.banco,
  JWT_SECRET: 'segredo-somente-para-testes-e2e-0123456789abcdef',
  JWT_EXPIRES_IN: '2h',
  DATA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  DISABLE_SCHEDULER: 'true',
  DEMO_ENABLED: 'true',
  DEFAULT_TENANT_SLUG: E2E.igrejas.a,
  APP_URL: E2E.webUrl,
  APP_TIMEZONE: 'America/Bahia',
  EVOLUTION_API_URL: E2E.mockUrl,
  EVOLUTION_INSTANCE: 'e2e',
  EVOLUTION_API_KEY: 'chave-falsa-e2e',
  WHATSAPP_NUMERO_INSTANCIA: `55${E2E.fones.bot}`,
  CHURCH_WHATSAPP_NUMBER: `55${E2E.fones.igreja}`,
  WHATSAPP_HORARIO_INICIO: '00:00',
  WHATSAPP_HORARIO_FIM: '23:59',
  WHATSAPP_DIGITANDO: 'false',
  // Intervalo entre envios em lote: o piso de 30s é regra do projeto e vale também nos testes.
  WHATSAPP_MIN_DELAY_SEG: '30',
  WHATSAPP_MAX_DELAY_SEG: '30',
  // A pausa de 5 min a cada 20 envios em lote somaria minutos à suíte (o contador é por igreja e
  // atravessa os specs). Só aqui, com WhatsApp falso, ela fica fora de alcance; o piso de 30s continua.
  WHATSAPP_PAUSA_A_CADA: '100000',
  // Limites por hora/dia contam TODAS as mensagens (inclusive respostas): a suíte troca ~100/h com a
  // igreja de teste e, com o limite real (60/h), o lote seguinte dormiria até virar a hora.
  WHATSAPP_LIMITE_HORA: '100000',
  WHATSAPP_LIMITE_DIA: '100000',
  FORCE_MOCK_RECIPIENT: 'false',
  PLATFORM_ADMIN_EMAIL: 'plataforma@e2e.test',
  PLATFORM_ADMIN_PASSWORD: 'Plataforma@E2e123',
  TRIAL_DAYS: '14',
  // Woovi falsa (mesmo servidor do WhatsApp falso): cobranças Pix da assinatura
  WOOVI_ENV: 'sandbox',
  WOOVI_SANDBOX_APP_ID: 'app-id-falso-e2e',
  WOOVI_API_URL: E2E.mockUrl,
  WOOVI_WEBHOOK_SECRET: 'segredo-webhook-e2e',
};

module.exports = E2E;
