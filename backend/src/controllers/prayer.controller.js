const { validationResult } = require('express-validator');
const templates = require('../templates/messages.templates');
const whatsapp = require('../services/whatsapp.service');
const Message = require('../models/Message.model');
const Person = require('../models/Person.model');

const sendPrayer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { mensagem } = req.body;
  const remetente = req.user.nome;
  const numero = process.env.CHURCH_WHATSAPP_NUMBER;
  const person = req.user.personId ? await Person.findById(req.user.personId).select('congregacao').lean() : null;
  const congregacao = person?.congregacao || '';

  const lastPrayer = await Message.findOne({ tipo: 'oracao', enviadoPor: req.user._id }).sort({ criadoEm: -1 });
  if (lastPrayer && Date.now() - new Date(lastPrayer.criadoEm).getTime() < 60 * 60 * 1000) {
    return res.status(429).json({ message: 'Aguarde 1 hora para enviar um novo pedido de oração.' });
  }

  const conteudo = templates.pedidoOracao(remetente, mensagem, congregacao);
  await whatsapp.sendSingle(numero, conteudo);

  await Message.create({
    tipo: 'oracao',
    destinatarios: [{ nome: 'IBBI', celular: numero }],
    conteudo,
    status: 'concluido',
    enviadoPor: req.user._id,
    origemNome: remetente,
    origemCongregacao: congregacao,
    concluidoEm: new Date(),
  });

  return res.json({ message: 'Pedido de oração enviado' });
};

module.exports = { sendPrayer };
