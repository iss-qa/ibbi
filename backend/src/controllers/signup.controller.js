const { PLANS, TRIAL_DAYS, TRIAL_PLAN } = require('../config/plans');
const { TERMOS_VERSAO } = require('../config/legal');
const { runAsPlatform } = require('../tenancy/context');
const { provisionTenant, ProvisionError, slugify, slugExists, availableSlug } = require('../tenancy/provision.service');
const { sendEmail } = require('../services/email.service');
const { welcomeEmailSubject, welcomeEmailHtml, signupAlertHtml } = require('../templates/welcome-email.template');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UF_RE = /^[A-Z]{2}$/;

const appUrl = () => String(process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const loginUrlFor = (slug) => `${appUrl()}/login?igreja=${encodeURIComponent(slug)}`;

// Disponibilidade de código (slug) enquanto o pastor digita no formulário.
const checkSlug = async (req, res) => {
  const slug = slugify(req.params.slug);
  if (slug.length < 2) return res.json({ slug, disponivel: false });
  const exists = await slugExists(slug);
  return res.json({ slug, disponivel: !exists, sugestao: exists ? await availableSlug(slug) : undefined });
};

// Cadastro público de igreja (landing page): cria o tenant em trial + master.
const signup = async (req, res) => {
  const b = req.body || {};
  // Honeypot: bots preenchem "website"; humanos não veem o campo.
  if (b.website) return res.status(201).json({ ok: true });

  const nome = String(b.nome || '').trim();
  const responsavel = String(b.responsavel || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const celular = String(b.celular || '').replace(/\D/g, '');
  const cidade = String(b.cidade || '').trim();
  const uf = String(b.uf || '').trim().toUpperCase();
  const plano = PLANS[b.plano] && !PLANS[b.plano].sobConsulta ? b.plano : TRIAL_PLAN;

  if (nome.length < 3) return res.status(400).json({ message: 'Informe o nome da igreja' });
  if (responsavel.length < 3) return res.status(400).json({ message: 'Informe o nome do responsável' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Informe um email válido' });
  if (celular.length < 10 || celular.length > 13) return res.status(400).json({ message: 'Informe um WhatsApp válido com DDD' });
  if (uf && !UF_RE.test(uf)) return res.status(400).json({ message: 'UF inválida' });
  if (!b.aceite) return res.status(400).json({ message: 'É preciso aceitar os termos de uso' });

  const slug = b.slug ? slugify(b.slug) : await availableSlug(nome);
  // Indicação (?ref=): a igreja indicada ganha +7 dias de teste; quem indicou ganha 1 mês na 1ª fatura paga.
  const indicacaoSvc = require('../services/indicacao.service');
  const indicador = b.ref ? await runAsPlatform(() => indicacaoSvc.resolverIndicador(b.ref, slug)) : null;
  if (slug.length < 2) return res.status(400).json({ message: 'Código da igreja inválido' });

  let tenant;
  let credenciais;
  try {
    ({ tenant, credenciais } = await provisionTenant({
      nome,
      nomeCurto: String(b.nomeCurto || '').trim() || undefined,
      slug,
      email,
      telefone: celular,
      responsavel,
      cidade: cidade || undefined,
      uf: uf || undefined,
      plano,
      master: { nome: responsavel, email, celular },
      trialDias: indicador ? TRIAL_DAYS + indicacaoSvc.BONUS_TRIAL_DIAS : undefined,
      indicacao: indicador ? { indicadoPor: indicador._id } : undefined,
      termos: { versao: TERMOS_VERSAO, aceitoEm: new Date(), aceitoPor: responsavel, ip: String(req.ip || '').slice(0, 64) },
    }, { origem: 'landing' }));
  } catch (err) {
    if (err instanceof ProvisionError) return res.status(err.status).json({ message: err.message, sugestao: err.sugestao });
    throw err;
  }

  const loginUrl = loginUrlFor(tenant.slug);
  const payload = {
    igreja: { nome: tenant.nome, slug: tenant.slug },
    responsavel, email, celular, cidade, uf, plano,
    login: credenciais.login,
    senhaTemporaria: credenciais.senhaTemporaria,
    loginUrl,
    trialDias: indicador ? TRIAL_DAYS + indicacaoSvc.BONUS_TRIAL_DIAS : TRIAL_DAYS,
  };

  // Emails são best-effort: a igreja já foi criada e as credenciais voltam na resposta.
  sendEmail({
    to: email,
    subject: welcomeEmailSubject(tenant.nome),
    html: welcomeEmailHtml({ ...payload, igreja: tenant.nome, slug: tenant.slug }),
  }).catch((err) => console.warn('[SIGNUP] Falha ao enviar boas-vindas:', err.message));

  const alertTo = process.env.ALERT_EMAIL || process.env.PLATFORM_ADMIN_EMAIL;
  if (alertTo) {
    sendEmail({
      to: alertTo,
      subject: `🐑 Nova igreja no PastorIA: ${tenant.nome}`,
      html: signupAlertHtml({ ...payload, igreja: tenant.nome, slug: tenant.slug }),
    }).catch((err) => console.warn('[SIGNUP] Falha ao avisar plataforma:', err.message));
  }

  return res.status(201).json({
    igreja: payload.igreja,
    login: credenciais.login,
    senhaTemporaria: credenciais.senhaTemporaria,
    loginUrl,
    trialEndsAt: tenant.trialEndsAt,
    plano: PLANS[plano].nome,
  });
};

module.exports = { signup, checkSlug };
