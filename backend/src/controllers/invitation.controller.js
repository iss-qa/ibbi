const Invitation = require('../models/Invitation.model');
const Person = require('../models/Person.model');
const RegistrationRequest = require('../models/RegistrationRequest.model');
const { sendPendingRegistrationWelcome } = require('../services/member.service');

const { runAsPlatform, runWithTenant } = require('../tenancy/context');
const { getTenantById, serializePublic } = require('../tenancy/tenant.service');
const { portalUrl } = require('../tenancy/brand');
const { randomToken } = require('../utils/crypto');
const { sanitizeFotoUrl, PUBLIC_PERSON_FIELDS, pickFields } = require('../utils/sanitize');
const { toLocal } = require('../utils/phone');
const { normalizePersonDates } = require('../utils/person-rules');

// Link permanente de cadastro externo: um por igreja (o da IBBI é migrado com o token histórico).
const createInvitation = async (req, res) => {
  let invite = await Invitation.findOne({ permanente: true });

  if (!invite) {
    invite = await Invitation.create({
      token: randomToken(24),
      permanente: true,
      createdBy: req.user?._id,
      expiresAt: null,
    });
  } else if (invite.expiresAt) {
    invite.expiresAt = null;
    await invite.save();
  }

  const origin = req.headers.origin || portalUrl();
  const link = `${origin}/external/${invite.token}`;

  res.json({ token: invite.token, link, expiresAt: null });
};

const normalizeName = (nome) => {
  if (!nome) return nome;
  return String(nome).trim().replace(/\s+/g, ' ').toLowerCase()
    .split(' ').map((w, i) => {
      if (i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com'].includes(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
};

// Rotas públicas: o token do convite identifica a igreja.
const findInviteTenant = async (token) => {
  const invite = await runAsPlatform(() => Invitation.findOne({ token }).lean());
  if (!invite) return {};
  return { invite, tenant: await getTenantById(invite.tenantId) };
};

const withInviteTenant = (handler) => async (req, res) => {
  const { invite, tenant } = await findInviteTenant(String(req.params.token || ''));
  if (!invite || !tenant) return res.status(404).json({ message: 'Convite inválido' });
  req.tenant = tenant;
  return runWithTenant(tenant, () => handler(req, res, invite));
};

const invitationTenant = withInviteTenant(async (req, res) => res.json(serializePublic(req.tenant)));

const submitInvitation = withInviteTenant(async (req, res, invite) => {
  if (!invite.permanente && invite.expiresAt && invite.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Convite expirado' });
  }

  // Só campos de cadastro (sem _id, matricula, status, acompanhado*…): isso vira Person na aprovação
  const payload = pickFields(req.body || {}, PUBLIC_PERSON_FIELDS);
  if (typeof payload.nome !== 'string' || !payload.nome.trim()) {
    return res.status(400).json({ message: 'Nome é obrigatório' });
  }
  // Celular com o campo de data como texto (navegador do WhatsApp/Instagram) manda "28/05/2026" ou lixo.
  // Nascimento inválido volta para a pessoa corrigir; batismo/casamento são opcionais e só são descartados.
  const datasInvalidas = normalizePersonDates(payload);
  if (datasInvalidas.includes('Data de nascimento')) {
    return res.status(400).json({ message: 'Data de nascimento inválida. Use o formato dd/mm/aaaa.' });
  }
  if (payload.congregacao !== undefined && typeof payload.congregacao !== 'string') delete payload.congregacao;
  if (payload.fotoUrl !== undefined) payload.fotoUrl = sanitizeFotoUrl(payload.fotoUrl);
  payload.nome = normalizeName(payload.nome);
  if (payload.celular) payload.celular = toLocal(payload.celular);

  // Validação de duplicidade com cadastros existentes
  if (payload.nome) {
    const escapedNome = payload.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nomeRegex = { $regex: new RegExp(`^${escapedNome}$`, 'i') };
    const orConditions = [];
    if (payload.celular) orConditions.push({ nome: nomeRegex, celular: payload.celular });
    if (payload.dataNascimento) orConditions.push({ nome: nomeRegex, dataNascimento: new Date(payload.dataNascimento) });

    if (orConditions.length > 0) {
      const existsPerson = await Person.findOne({ $or: orConditions });
      if (existsPerson) {
        return res.status(409).json({
          code: 'DUPLICATE',
          message: `O cadastro de "${payload.nome}" já foi realizado anteriormente. Caso precise atualizar seus dados, entre em contato com a secretaria da igreja.`,
        });
      }

      // Duplicidade com solicitações pendentes: mesmo critério (nome + celular/nascimento).
      // Só pelo nome, qualquer um bloquearia o cadastro de outra pessoa enviando o nome dela antes.
      const pendingOr = [];
      if (payload.celular) pendingOr.push({ nome: nomeRegex, celular: payload.celular });
      if (payload.dataNascimento) pendingOr.push({ nome: nomeRegex, 'submittedData.dataNascimento': payload.dataNascimento });
      const existsRequest = await RegistrationRequest.findOne({ $or: pendingOr, status: 'pending' });
      if (existsRequest) {
        return res.status(409).json({
          code: 'DUPLICATE_REQUEST',
          message: `Já existe uma solicitação de cadastro em análise para "${payload.nome}". Aguarde a aprovação da administração.`,
        });
      }
    }
  }

  // Criar solicitação pendente (não cria Person nem User)
  const request = await RegistrationRequest.create({
    nome: payload.nome,
    celular: payload.celular,
    congregacao: payload.congregacao,
    fotoUrl: payload.fotoUrl,
    submittedData: payload,
    status: 'pending',
  });

  // Em segundo plano: o anti-ban pode aguardar o intervalo/janela de horário
  sendPendingRegistrationWelcome({
    nome: request.nome,
    celular: request.celular,
  }).catch((err) => console.error('Erro ao enviar boas-vindas do cadastro pendente:', err.message));

  res.json({
    message: 'Cadastro recebido com sucesso! Sua solicitação está em análise. Aguarde a aprovação da administração da igreja.',
    status: 'pending',
  });
});

module.exports = { createInvitation, submitInvitation, invitationTenant };
