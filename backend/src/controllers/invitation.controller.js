const crypto = require('crypto');
const Invitation = require('../models/Invitation.model');
const Person = require('../models/Person.model');
const { onboardMember } = require('../services/member.service');

const clearFieldsByTipo = (payload) => {
  if (payload.tipo === 'visitante' || payload.tipo === 'novo decidido') {
    delete payload.email;
    delete payload.grupo;
    delete payload.estadoCivil;
    delete payload.endereco;
    delete payload.ministerio;
    delete payload.batizado;
    delete payload.dataBatismo;
    delete payload.status;
    delete payload.motivoInativacao;
  }

  if (payload.tipo === 'visitante') {
    delete payload.dataDecisao;
  }

  if (payload.tipo === 'novo decidido') {
    delete payload.dataVisita;
  }

  if (payload.tipo !== 'visitante' && payload.tipo !== 'novo decidido') {
    delete payload.dataVisita;
    delete payload.dataDecisao;
  }
};

const PERMANENT_TOKEN = '9b34cf8ae96bc49d6b388b5a0a68f2a39578297def76faf6';

const createInvitation = async (req, res) => {
  // Garantir que o convite fixo existe no banco
  let invite = await Invitation.findOne({ token: PERMANENT_TOKEN });
  
  if (!invite) {
    invite = await Invitation.create({
      token: PERMANENT_TOKEN,
      createdBy: req.user?._id,
      expiresAt: null, // Convite eterno
    });
  } else if (invite.expiresAt) {
    invite.expiresAt = null;
    await invite.save();
  }

  const origin = req.headers.origin || 'https://ibbi.issqa.com.br';
  const link = `${origin}/external/${invite.token}`;

  res.json({ token: invite.token, link, expiresAt: null });
};

const submitInvitation = async (req, res) => {
  const { token } = req.params;
  const invite = await Invitation.findOne({ token });

  if (!invite) return res.status(404).json({ message: 'Convite inválido' });
  
  // Apenas verifica expiração se não for o token permanente ou se explicitamente configurado
  if (invite.token !== PERMANENT_TOKEN && invite.expiresAt && invite.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Convite expirado' });
  }

  const payload = { ...req.body, status: 'ativo' };
  if (payload.nome) {
    payload.nome = String(payload.nome).trim().replace(/\s+/g, ' ').toLowerCase()
      .split(' ').map((w, i) => {
        if (i > 0 && ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com'].includes(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ');
  }
  if (payload.celular) payload.celular = String(payload.celular).replace(/\D/g, '');
  ['sexo', 'tipo', 'grupo', 'estadoCivil', 'congregacao', 'status', 'motivoInativacao'].forEach((field) => {
    if (payload[field] === '') delete payload[field];
  });
  clearFieldsByTipo(payload);

  // Validação de duplicidade: nome + celular OU nome + dataNascimento
  if (payload.nome) {
    const escapedNome = payload.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nomeRegex = { $regex: new RegExp(`^${escapedNome}$`, 'i') };
    const orConditions = [];
    if (payload.celular) orConditions.push({ nome: nomeRegex, celular: payload.celular });
    if (payload.dataNascimento) orConditions.push({ nome: nomeRegex, dataNascimento: new Date(payload.dataNascimento) });

    if (orConditions.length > 0) {
      const exists = await Person.findOne({ $or: orConditions });
      if (exists) {
        return res.status(409).json({
          code: 'DUPLICATE',
          message: `O cadastro de "${payload.nome}" já foi realizado anteriormente. Caso precise atualizar seus dados, entre em contato com a secretaria da igreja.`,
        });
      }
    }
  }

  const person = await Person.create(payload);
  const credentials = await onboardMember(person, null); // null pois é cadastro externo, não há "autor" logado

  res.json({ 
    message: 'Cadastro realizado', 
    personId: person._id,
    generatedUser: credentials ? {
      login: credentials.login,
      senha: credentials.password
    } : null
  });
};

module.exports = { createInvitation, submitInvitation };
