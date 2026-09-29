const crypto = require('crypto');
const Tenant = require('../models/Tenant.model');
const Person = require('../models/Person.model');
const User = require('../models/User.model');
const { PLANS, TRIAL_DAYS } = require('../config/plans');
const { runWithTenant } = require('./context');
const { randomToken } = require('../utils/crypto');
const { buildUniqueLogin } = require('../utils/login');

const DAY_MS = 24 * 60 * 60 * 1000;

class ProvisionError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

// "Igreja Batista da Paz" → "igreja-batista-da-paz" (formato aceito por Tenant.slug)
const slugify = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40)
  .replace(/-+$/, '');

const slugExists = (slug) => Tenant.exists({ slug });

// Primeiro slug livre a partir de uma base: base, base-2, base-3…
const availableSlug = async (base) => {
  const root = slugify(base) || 'igreja';
  let candidate = root;
  let n = 2;
  while (await slugExists(candidate)) {
    candidate = `${root.slice(0, 40 - String(n).length - 1)}-${n}`;
    n += 1;
  }
  return candidate;
};

// Cria a igreja (tenant) e o seu usuário master inicial.
// Usado pelo painel da plataforma e pelo cadastro público da landing page.
const provisionTenant = async (b = {}, { origem = 'painel' } = {}) => {
  if (!b.nome || !b.slug) throw new ProvisionError(400, 'Nome e código (slug) são obrigatórios');
  const plano = b.plano || 'crescer';
  if (!PLANS[plano]) throw new ProvisionError(400, 'Plano inválido');
  const slug = String(b.slug).toLowerCase();
  if (await slugExists(slug)) throw new ProvisionError(409, 'Código já em uso', { sugestao: await availableSlug(slug) });

  const trial = b.trial !== false;
  let tenant;
  try {
    tenant = await Tenant.create({
      nome: b.nome,
      nomeCurto: b.nomeCurto || b.nome,
      slug,
      documento: b.documento,
      email: b.email,
      telefone: b.telefone,
      responsavel: b.responsavel,
      cidade: b.cidade,
      uf: b.uf,
      plano,
      status: trial ? 'trial' : 'ativa',
      trialEndsAt: trial ? new Date(Date.now() + (Number(b.trialDias) || TRIAL_DAYS) * DAY_MS) : undefined,
      billing: { ciclo: b.ciclo || 'mensal', valorMensal: b.valorMensal ?? undefined, diaVencimento: b.diaVencimento || 10, isento: Boolean(b.isento) },
      congregacoes: b.congregacoes?.length ? b.congregacoes : ['Sede'],
      timezone: b.timezone || 'America/Sao_Paulo',
      whatsapp: { provider: 'none', webhookToken: randomToken(20) },
      onboarding: { origem },
    });
  } catch (err) {
    throw new ProvisionError(400, err.message);
  }

  // Master inicial da igreja (senha temporária, troca obrigatória no primeiro login).
  const master = b.master || {};
  const senhaTemporaria = crypto.randomBytes(5).toString('hex');
  const credenciais = await runWithTenant(tenant.toObject(), async () => {
    const person = await Person.create({
      nome: master.nome || b.responsavel || 'Administrador',
      celular: master.celular ? String(master.celular).replace(/\D/g, '') : undefined,
      email: master.email || b.email,
      congregacao: tenant.congregacoes[0],
      tipo: 'membro',
    });
    const loginName = master.login || await buildUniqueLogin(person.nome);
    await User.create({
      nome: person.nome, login: loginName, senha: senhaTemporaria, role: 'master', personId: person._id, mustChangePassword: true,
    });
    return { login: loginName, senhaTemporaria };
  });

  return { tenant, credenciais };
};

module.exports = { ProvisionError, slugify, slugExists, availableSlug, provisionTenant };
