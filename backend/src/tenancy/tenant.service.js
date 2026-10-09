const Tenant = require('../models/Tenant.model');
const { getPlan, limitFor } = require('../config/plans');
const { mask } = require('../utils/crypto');

const DEFAULT_TENANT_SLUG = () => (process.env.DEFAULT_TENANT_SLUG || 'ibbi').toLowerCase();
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // id -> { tenant, at }

const remember = (tenant) => {
  if (tenant) cache.set(String(tenant._id), { tenant, at: Date.now() });
  return tenant;
};

const getTenantById = async (id) => {
  if (!id) return null;
  const hit = cache.get(String(id));
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tenant;
  return remember(await Tenant.findById(id).lean());
};

const getTenantBySlug = async (slug) => {
  if (!slug) return null;
  const normalized = String(slug).trim().toLowerCase();
  for (const { tenant, at } of cache.values()) {
    if (tenant.slug === normalized && Date.now() - at < CACHE_TTL_MS) return tenant;
  }
  return remember(await Tenant.findOne({ slug: normalized }).lean());
};

const invalidateTenant = (id) => cache.delete(String(id));

const listActiveTenants = () => Tenant.find({ status: { $in: ['trial', 'ativa', 'inadimplente'] } }).lean();

// Slug da igreja: body.igreja → header X-Tenant → subdomínio (<slug>.APP_BASE_DOMAIN) → default.
const slugFromRequest = (req) => {
  const explicit = req.body?.igreja || req.body?.tenant || req.headers['x-tenant'] || req.query?.igreja;
  if (explicit) return String(explicit);
  const baseDomain = process.env.APP_BASE_DOMAIN;
  const host = String(req.headers.host || '').split(':')[0];
  if (baseDomain && host.endsWith(`.${baseDomain}`)) {
    const sub = host.slice(0, -(baseDomain.length + 1));
    if (sub && !['www', 'app', 'admin'].includes(sub)) return sub;
  }
  return DEFAULT_TENANT_SLUG();
};

const serializePublic = (tenant) => tenant && ({
  id: tenant._id,
  slug: tenant.slug,
  nome: tenant.nome,
  nomeCurto: tenant.nomeCurto || tenant.nome,
  branding: tenant.branding || {},
  congregacoes: tenant.congregacoes || [],
  status: tenant.status,
  demo: Boolean(tenant.demo),
});

// Visão do tenant para os usuários da própria igreja (segredos mascarados).
const serializeForTenantAdmin = (tenant) => {
  if (!tenant) return null;
  const plan = getPlan(tenant.plano);
  const wa = tenant.whatsapp || {};
  return {
    ...serializePublic(tenant),
    documento: tenant.documento,
    email: tenant.email,
    telefone: tenant.telefone,
    responsavel: tenant.responsavel,
    timezone: tenant.timezone,
    plano: tenant.plano,
    planoInfo: { nome: plan.nome, features: plan.features, limites: {
      pessoas: limitFor(tenant, 'pessoas'),
      whatsappMensagensMes: limitFor(tenant, 'whatsappMensagensMes'),
      iaInteracoesMes: limitFor(tenant, 'iaInteracoesMes'),
    } },
    trialEndsAt: tenant.trialEndsAt,
    billing: { ciclo: tenant.billing?.ciclo, diaVencimento: tenant.billing?.diaVencimento, isento: tenant.billing?.isento },
    whatsapp: {
      provider: wa.provider,
      useEnvFallback: wa.useEnvFallback,
      numeroIgreja: wa.numeroIgreja,
      numeroInstancia: wa.numeroInstancia || (wa.useEnvFallback ? process.env.WHATSAPP_NUMERO_INSTANCIA : ''),
      apresentacaoEnviadaEm: wa.apresentacaoEnviadaEm || null,
      // webhookToken nunca sai aqui: autentica o webhook (quem tem o token fala "como" qualquer número). Só em /webhook-info.
      grupoLideranca: wa.grupoLideranca || null,
      liderancaEnvio: wa.liderancaEnvio || 'individual',
      antiban: require('../services/whatsapp/antiban').config(tenant),
      evolution: {
        url: wa.evolution?.url,
        instance: wa.evolution?.instance,
        apiKey: wa.evolution?.apiKeyEnc ? mask('configurada') : '',
        configurada: Boolean(wa.evolution?.apiKeyEnc),
      },
      cloud: {
        phoneNumberId: wa.cloud?.phoneNumberId,
        wabaId: wa.cloud?.wabaId,
        accessToken: wa.cloud?.accessTokenEnc ? mask('configurado') : '',
        configurada: Boolean(wa.cloud?.accessTokenEnc),
        templates: wa.cloud?.templates || {},
      },
    },
    automacoes: tenant.automacoes,
    onboarding: { concluido: Boolean(tenant.onboarding?.concluido), dispensado: Boolean(tenant.onboarding?.dispensado) },
    cidade: tenant.cidade,
    uf: tenant.uf,
    pix: tenant.pix || {},
    cultosProgramados: tenant.cultosProgramados || [],
    termosPendentes: tenant.termos?.versao !== require('../config/legal').TERMOS_VERSAO,
    termos: tenant.termos ? { versao: tenant.termos.versao, aceitoEm: tenant.termos.aceitoEm, aceitoPor: tenant.termos.aceitoPor } : null,
    ia: tenant.ia,
    lideranca: tenant.lideranca || [],
    ebdLideres: tenant.ebdLideres || [],
  };
};

// Visão para admin/user: só o que a interface usa (plano, recursos, nome do assistente).
// Telefones da liderança, automações e configuração de WhatsApp ficam restritos ao master.
const serializeForMember = (tenant, role) => {
  if (!tenant) return null;
  const full = serializeForTenantAdmin(tenant);
  return {
    ...serializePublic(tenant),
    plano: full.plano,
    planoInfo: full.planoInfo,
    trialEndsAt: full.trialEndsAt,
    timezone: full.timezone,
    ia: { nomeAssistente: tenant.ia?.nomeAssistente },
    ...(role === 'admin' ? { automacoes: tenant.automacoes } : {}),
  };
};

module.exports = {
  serializeForMember,
  DEFAULT_TENANT_SLUG,
  getTenantById,
  getTenantBySlug,
  invalidateTenant,
  listActiveTenants,
  slugFromRequest,
  serializePublic,
  serializeForTenantAdmin,
};
