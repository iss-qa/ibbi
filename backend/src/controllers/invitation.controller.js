const crypto = require('crypto');
const Invitation = require('../models/Invitation.model');
const Person = require('../models/Person.model');

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
  if (payload.celular) payload.celular = String(payload.celular).replace(/\D/g, '');
  ['sexo', 'tipo', 'grupo', 'estadoCivil', 'congregacao', 'status', 'motivoInativacao'].forEach((field) => {
    if (payload[field] === '') delete payload[field];
  });
  clearFieldsByTipo(payload);

  // Validação de duplicidade: Mesmo nome e celular
  if (payload.nome && payload.celular) {
    // Escapa caracteres especiais do regex e busca com case-insensitive
    const escapedNome = payload.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exists = await Person.findOne({ 
      nome: { $regex: new RegExp(`^${escapedNome}$`, 'i') }, 
      celular: payload.celular 
    });
    
    if (exists) {
      return res.status(400).json({ 
        message: `O membro "${payload.nome}" já possui um cadastro com o celular informado.` 
      });
    }
  }

  const person = await Person.create(payload);

  res.json({ message: 'Cadastro realizado', personId: person._id });
};

module.exports = { createInvitation, submitInvitation };
