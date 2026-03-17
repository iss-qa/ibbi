const { validationResult } = require('express-validator');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const whatsapp = require('../services/whatsapp.service');
const { sendBirthdayMessages } = require('../services/scheduler.service');

const applyVariables = (template, person) => {
  if (!template) return '';
  return template
    .replace(/\{nome\}/gi, person?.nome || '')
    .replace(/\{congregacao\}/gi, person?.congregacao || '');
};

const logAndSendBatch = async ({ tipo, destinatarios, mensagem, enviadoPor }) => {
  const messageLog = await Message.create({
    tipo,
    destinatarios,
    conteudo: mensagem,
    status: 'enviando',
    enviadoPor,
  });

  const erros = [];
  let processed = 0;

  await whatsapp.sendBatch(destinatarios, (dest) => applyVariables(mensagem, dest), async (dest, err) => {
    processed += 1;
    if (err) {
      erros.push({ celular: dest.celular, motivo: err.message });
    }

    if (processed === destinatarios.length) {
      await Message.findByIdAndUpdate(messageLog._id, {
        status: erros.length > 0 ? 'erro' : 'concluido',
        concluidoEm: new Date(),
        erros,
      });
    }
  });

  return messageLog;
};

const sendIndividual = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { personId, celular, mensagem } = req.body;
  let person = null;

  if (personId) person = await Person.findById(personId);
  if (!person && celular) person = await Person.findOne({ celular: String(celular).replace(/\D/g, '') });

  const destinatario = {
    nome: person?.nome || 'Membro',
    celular: person?.celular || celular,
    congregacao: person?.congregacao,
  };

  const conteudo = applyVariables(mensagem, destinatario);

  try {
    await whatsapp.sendSingle(destinatario.celular, conteudo);
    const messageLog = await Message.create({
      tipo: 'personalizada',
      destinatarios: [{ nome: destinatario.nome, celular: destinatario.celular }],
      conteudo,
      status: 'concluido',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
    });
    return res.json({ message: 'Mensagem enviada', log: messageLog });
  } catch (err) {
    const messageLog = await Message.create({
      tipo: 'personalizada',
      destinatarios: [{ nome: destinatario.nome, celular: destinatario.celular }],
      conteudo,
      status: 'erro',
      enviadoPor: req.user._id,
      concluidoEm: new Date(),
      erros: [{ celular: destinatario.celular, motivo: err.message }],
    });
    return res.status(500).json({ message: err.message, log: messageLog });
  }
};

const sendByGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { grupo, mensagem } = req.body;
  const pessoas = await Person.find({ grupo, status: 'ativo', celular: { $ne: '' } });
  const destinatarios = pessoas.map((p) => ({
    nome: p.nome,
    celular: p.celular,
    congregacao: p.congregacao,
  }));

  const log = await logAndSendBatch({
    tipo: 'aviso',
    destinatarios,
    mensagem,
    enviadoPor: req.user._id,
  });

  return res.json({ message: 'Envio enfileirado', log });
};

const sendByCongregation = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { congregacao, mensagem } = req.body;
  const pessoas = await Person.find({ congregacao, status: 'ativo', celular: { $ne: '' } });
  const destinatarios = pessoas.map((p) => ({
    nome: p.nome,
    celular: p.celular,
    congregacao: p.congregacao,
  }));

  const log = await logAndSendBatch({
    tipo: 'aviso',
    destinatarios,
    mensagem,
    enviadoPor: req.user._id,
  });

  return res.json({ message: 'Envio enfileirado', log });
};

const log = async (req, res) => {
  const items = await Message.find().sort({ criadoEm: -1 }).limit(200);
  res.json(items);
};

const prayerLog = async (req, res) => {
  const items = await Message.find({ tipo: 'oracao' }).sort({ criadoEm: -1 }).limit(200).populate('enviadoPor', 'nome');
  const mapped = items.map((item) => ({
    _id: item._id,
    data: item.criadoEm,
    nome: item.enviadoPor?.nome || 'Usuário',
    conteudo: item.conteudo,
  }));
  res.json(mapped);
};

const queueStatus = (req, res) => {
  res.json(whatsapp.getQueueStatus());
};

const cancelQueue = (req, res) => {
  whatsapp.cancelQueue();
  res.json({ message: 'Fila cancelada' });
};

const sendBirthdayNow = async (req, res) => {
  await sendBirthdayMessages();
  res.json({ message: 'Envio de aniversários disparado' });
};

const resendMessage = async (req, res) => {
  const msg = await Message.findById(req.params.id);
  if (!msg) return res.status(404).json({ message: 'Mensagem não encontrada' });
  if (!msg.destinatarios || msg.destinatarios.length === 0) {
    return res.status(400).json({ message: 'Mensagem sem destinatários' });
  }

  const log = await logAndSendBatch({
    tipo: msg.tipo,
    destinatarios: msg.destinatarios,
    mensagem: msg.conteudo,
    enviadoPor: req.user._id,
  });

  res.json({ message: 'Reenvio enfileirado', log });
};

module.exports = {
  sendIndividual,
  sendByGroup,
  sendByCongregation,
  log,
  prayerLog,
  queueStatus,
  cancelQueue,
  sendBirthdayNow,
  resendMessage,
};
