const Tenant = require('../models/Tenant.model');
const whatsapp = require('./whatsapp.service');
const { apresentarNumero } = require('./leadership.service');
const { encrypt } = require('../utils/crypto');
const { invalidateTenant, getTenantById } = require('../tenancy/tenant.service');
const { runWithTenant } = require('../tenancy/context');
const { hasFeature } = require('../config/plans');

const digits = (v) => String(v || '').replace(/\D/g, '');

/**
 * Aplica a configuração da instância de WhatsApp a um tenant (documento Mongoose).
 * Retorna true se algo da conexão mudou (provider, URL, instância, chave ou número).
 */
const applyWhatsappConfig = (tenant, w = {}) => {
  const antes = JSON.stringify([tenant.whatsapp.provider, tenant.whatsapp.evolution, tenant.whatsapp.cloud?.phoneNumberId, tenant.whatsapp.numeroInstancia]);
  if (w.provider === 'cloud' && !hasFeature(tenant, 'whatsappOficial')) {
    const err = new Error('WhatsApp Oficial disponível a partir do plano Multiplicar.');
    err.status = 403;
    throw err;
  }
  if (w.provider) tenant.whatsapp.provider = w.provider;
  if (w.numeroIgreja !== undefined) tenant.whatsapp.numeroIgreja = digits(w.numeroIgreja);
  if (w.numeroInstancia !== undefined) {
    const n = digits(w.numeroInstancia);
    tenant.whatsapp.numeroInstancia = n && !n.startsWith('55') && n.length <= 11 ? `55${n}` : n;
  }
  if (w.evolution) {
    if (w.evolution.url !== undefined) tenant.whatsapp.evolution.url = String(w.evolution.url).trim().replace(/\/$/, '');
    if (w.evolution.instance !== undefined) tenant.whatsapp.evolution.instance = String(w.evolution.instance).trim();
    if (w.evolution.apiKey && !w.evolution.apiKey.includes('••')) tenant.whatsapp.evolution.apiKeyEnc = encrypt(w.evolution.apiKey.trim());
  }
  if (w.cloud) {
    if (w.cloud.phoneNumberId !== undefined) tenant.whatsapp.cloud.phoneNumberId = w.cloud.phoneNumberId;
    if (w.cloud.wabaId !== undefined) tenant.whatsapp.cloud.wabaId = w.cloud.wabaId;
    if (w.cloud.accessToken && !w.cloud.accessToken.includes('••')) tenant.whatsapp.cloud.accessTokenEnc = encrypt(w.cloud.accessToken);
    if (w.cloud.templates) tenant.whatsapp.cloud.templates = w.cloud.templates;
  }
  if (tenant.whatsapp.provider !== 'none') tenant.whatsapp.useEnvFallback = false;
  const depois = JSON.stringify([tenant.whatsapp.provider, tenant.whatsapp.evolution, tenant.whatsapp.cloud?.phoneNumberId, tenant.whatsapp.numeroInstancia]);
  return antes !== depois;
};

// Número novo e conectado → apresenta à liderança ("salve nosso contato"), em segundo plano.
const apresentarSeConectado = async (tenantId) => {
  const tenant = await getTenantById(tenantId);
  return runWithTenant(tenant, async () => {
    const estado = await whatsapp.connectionState().catch(() => ({ online: false }));
    if (!estado.online) return { enviado: false, motivo: 'WhatsApp desconectado' };
    return apresentarNumero();
  });
};

const saveWhatsappConfig = async (tenantId, w) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw Object.assign(new Error('Igreja não encontrada'), { status: 404 });
  const mudou = applyWhatsappConfig(tenant, w);
  await tenant.save();
  invalidateTenant(tenant._id);
  if (mudou && w.apresentarAutomatico !== false) {
    apresentarSeConectado(tenant._id).catch((err) => console.error('[WHATSAPP] Apresentação automática:', err.message));
  }
  return { tenant, mudou };
};

module.exports = { applyWhatsappConfig, apresentarSeConectado, saveWhatsappConfig, digits };
