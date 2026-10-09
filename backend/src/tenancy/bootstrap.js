const Tenant = require('../models/Tenant.model');
const PlatformUser = require('../models/PlatformUser.model');
const Person = require('../models/Person.model');
const User = require('../models/User.model');
const Message = require('../models/Message.model');
const EbdAula = require('../models/EbdAula.model');
const Invitation = require('../models/Invitation.model');
const RegistrationRequest = require('../models/RegistrationRequest.model');
const ProjetoAmigoAcao = require('../models/ProjetoAmigoAcao.model');
const TriagemGrupo = require('../models/TriagemGrupo.model');
const Conversation = require('../models/Conversation.model');
const CareAlert = require('../models/CareAlert.model');
const AutomationRun = require('../models/AutomationRun.model');
const GrupoEncontro = require('../models/GrupoEncontro.model');
const Encontro = require('../models/Encontro.model');
const { runAsPlatform } = require('./context');
const { DEFAULT_TENANT_SLUG } = require('./tenant.service');
const { randomToken } = require('../utils/crypto');

const LEGACY_MODELS = [Person, User, Message, EbdAula, Invitation, RegistrationRequest, ProjetoAmigoAcao, TriagemGrupo];
const TENANT_MODELS = [...LEGACY_MODELS, Conversation, CareAlert, AutomationRun, GrupoEncontro, Encontro];

// Índices únicos globais da versão single-tenant, substituídos por compostos com tenantId.
const LEGACY_INDEXES = [
  [User, 'login_1'],
  [Person, 'matricula_1'],
  [EbdAula, 'data_1_classe_1'],
  [Encontro, 'tenantId_1_ebdAulaId_1'],
  // Deixou de ser único (só remove se ainda estiver como único)
  [Encontro, 'tenantId_1_grupoId_1_data_1_atividade_1', (i) => i.unique],
];
const LEGACY_PERMANENT_TOKEN = '9b34cf8ae96bc49d6b388b5a0a68f2a39578297def76faf6';

const createFounderTenant = () => Tenant.create({
  nome: 'Igreja Batista Bíblica Israel',
  nomeCurto: 'IBBI',
  slug: DEFAULT_TENANT_SLUG(),
  status: 'ativa',
  plano: 'multiplicar',
  billing: { isento: true, ciclo: 'mensal' }, // cliente fundador
  timezone: process.env.APP_TIMEZONE || 'America/Bahia',
  congregacoes: Person.CONGREGACOES.filter((c) => c !== 'Não atribuído'),
  branding: { portalUrl: process.env.APP_URL || 'https://pastoria.issqa.com.br', corPrimaria: '#0a1f44', corSecundaria: '#c9a227' },
  whatsapp: {
    provider: 'none',
    useEnvFallback: true,
    numeroIgreja: process.env.CHURCH_WHATSAPP_NUMBER,
    webhookToken: randomToken(20),
  },
  onboarding: { concluido: true, origem: 'fundador' },
});

const dropLegacyIndexes = async () => {
  for (const [Model, name, when = () => true] of LEGACY_INDEXES) {
    try {
      const indexes = await Model.collection.indexes();
      if (indexes.some((i) => i.name === name && when(i))) {
        await Model.collection.dropIndex(name);
        console.log(`[TENANCY] Índice legado removido: ${Model.collection.collectionName}.${name}`);
      }
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') console.warn(`[TENANCY] Falha ao remover índice ${name}:`, err.message);
    }
  }
};

/**
 * Migração idempotente executada na subida do servidor:
 * 1. Cria a igreja fundadora (IBBI) se ainda não houver nenhum tenant.
 * 2. Carimba tenantId em todos os documentos legados sem tenant.
 * 3. Troca índices únicos globais por compostos.
 * 4. Cria o operador inicial da plataforma (PLATFORM_ADMIN_EMAIL/PASSWORD).
 */
const bootstrapTenancy = () => runAsPlatform(async () => {
  let founder = await Tenant.findOne({ slug: DEFAULT_TENANT_SLUG() });
  if (!founder && (await Tenant.estimatedDocumentCount()) === 0) {
    founder = await createFounderTenant();
    console.log(`[TENANCY] Tenant fundador criado: ${founder.nome} (${founder.slug})`);
  }

  await dropLegacyIndexes();

  if (founder) {
    for (const Model of LEGACY_MODELS) {
      // Driver nativo: ignora o tenantPlugin de propósito.
      const r = await Model.collection.updateMany({ tenantId: { $exists: false } }, { $set: { tenantId: founder._id } });
      if (r.modifiedCount) console.log(`[TENANCY] ${r.modifiedCount} documento(s) de ${Model.collection.collectionName} vinculados a ${founder.slug}`);
    }
    await Invitation.collection.updateOne({ token: LEGACY_PERMANENT_TOKEN }, { $set: { permanente: true } });
  }

  for (const Model of [...TENANT_MODELS, Tenant]) {
    await Model.createIndexes().catch((err) => console.warn(`[TENANCY] Índices de ${Model.modelName}:`, err.message));
  }

  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const senha = process.env.PLATFORM_ADMIN_PASSWORD;
  if (email && senha && !(await PlatformUser.exists({ email: email.toLowerCase() }))) {
    await PlatformUser.create({ nome: process.env.PLATFORM_ADMIN_NAME || 'Administrador da Plataforma', email, senha });
    console.log(`[TENANCY] Operador da plataforma criado: ${email}`);
  }
});

module.exports = { bootstrapTenancy };
