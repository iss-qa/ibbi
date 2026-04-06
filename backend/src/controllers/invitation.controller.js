const Invitation = require('../models/Invitation.model');
const Person = require('../models/Person.model');
const RegistrationRequest = require('../models/RegistrationRequest.model');

const PERMANENT_TOKEN = '9b34cf8ae96bc49d6b388b5a0a68f2a39578297def76faf6';

const createInvitation = async (req, res) => {
  let invite = await Invitation.findOne({ token: PERMANENT_TOKEN });

  if (!invite) {
    invite = await Invitation.create({
      token: PERMANENT_TOKEN,
      createdBy: req.user?._id,
      expiresAt: null,
    });
  } else if (invite.expiresAt) {
    invite.expiresAt = null;
    await invite.save();
  }

  const origin = req.headers.origin || 'https://ibbi.issqa.com.br';
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

const submitInvitation = async (req, res) => {
  const { token } = req.params;
  const invite = await Invitation.findOne({ token });

  if (!invite) return res.status(404).json({ message: 'Convite inválido' });

  if (invite.token !== PERMANENT_TOKEN && invite.expiresAt && invite.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Convite expirado' });
  }

  const payload = { ...req.body };
  if (payload.nome) payload.nome = normalizeName(payload.nome);
  if (payload.celular) payload.celular = String(payload.celular).replace(/\D/g, '');

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

      // Verificar duplicidade com solicitações pendentes
      const existsRequest = await RegistrationRequest.findOne({
        nome: nomeRegex,
        status: 'pending',
      });
      if (existsRequest) {
        return res.status(409).json({
          code: 'DUPLICATE_REQUEST',
          message: `Já existe uma solicitação de cadastro em análise para "${payload.nome}". Aguarde a aprovação da administração.`,
        });
      }
    }
  }

  // Criar solicitação pendente (não cria Person nem User)
  await RegistrationRequest.create({
    nome: payload.nome,
    celular: payload.celular,
    congregacao: payload.congregacao,
    fotoUrl: payload.fotoUrl,
    submittedData: payload,
    status: 'pending',
  });

  res.json({
    message: 'Cadastro recebido com sucesso! Sua solicitação está em análise. Aguarde a aprovação da administração da igreja.',
    status: 'pending',
  });
};

module.exports = { createInvitation, submitInvitation };
