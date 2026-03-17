const crypto = require('crypto');
const Invitation = require('../models/Invitation.model');
const Person = require('../models/Person.model');

const createInvitation = async (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await Invitation.create({
    token,
    createdBy: req.user?._id,
    expiresAt,
  });

  const origin = req.headers.origin || 'http://localhost:4173';
  const link = `${origin}/external/${token}`;

  res.json({ token: invite.token, link, expiresAt });
};

const submitInvitation = async (req, res) => {
  const { token } = req.params;
  const invite = await Invitation.findOne({ token });

  if (!invite) return res.status(404).json({ message: 'Convite inválido' });
  if (invite.usedAt) return res.status(400).json({ message: 'Convite já utilizado' });
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Convite expirado' });
  }

  const payload = { ...req.body, status: 'ativo' };
  if (payload.celular) payload.celular = String(payload.celular).replace(/\D/g, '');
  ['sexo', 'tipo', 'grupo', 'estadoCivil', 'congregacao', 'status', 'motivoInativacao'].forEach((field) => {
    if (payload[field] === '') delete payload[field];
  });
  const person = await Person.create(payload);

  invite.usedAt = new Date();
  await invite.save();

  res.json({ message: 'Cadastro realizado', personId: person._id });
};

module.exports = { createInvitation, submitInvitation };
