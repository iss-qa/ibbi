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

const createInvitation = async (req, res) => {
  let invite = await Invitation.findOne({ createdBy: req.user?._id }).sort({ createdAt: -1 });

  if (!invite) {
    const token = crypto.randomBytes(24).toString('hex');

    invite = await Invitation.create({
      token,
      createdBy: req.user?._id,
    });
  } else if (invite.expiresAt) {
    invite.expiresAt = undefined;
    await invite.save();
  }

  const origin = req.headers.origin || 'http://localhost:4173';
  const link = `${origin}/external/${invite.token}`;

  res.json({ token: invite.token, link, expiresAt: invite.expiresAt || null });
};

const submitInvitation = async (req, res) => {
  const { token } = req.params;
  const invite = await Invitation.findOne({ token });

  if (!invite) return res.status(404).json({ message: 'Convite inválido' });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
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
