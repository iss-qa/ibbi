const { validationResult } = require('express-validator');
const Person = require('../models/Person.model');
const prayer = require('../services/prayer.service');
const { applyScopedCongregacaoFilter } = require('../utils/access');

const sendPrayer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { mensagem } = req.body;
  if (await prayer.pedidoRecente({ userId: req.user._id })) {
    return res.status(429).json({ message: 'Aguarde 1 hora para enviar um novo pedido de oração.' });
  }
  const person = req.user.personId ? await Person.findById(req.user.personId).select('congregacao celular').lean() : null;
  await prayer.registrarPedido({
    nome: req.user.nome,
    personId: req.user.personId,
    userId: req.user._id,
    celular: person?.celular,
    congregacao: person?.congregacao || '',
    texto: String(mensagem).trim(),
    origem: 'web',
    enviadoPor: req.user._id,
  });
  return res.json({ message: 'Pedido de oração enviado' });
};

// Lista para a liderança (admin vê as próprias congregações; master, todas).
const listPrayers = async (req, res) => {
  const dias = Math.min(Math.max(Number(req.query.dias) || 30, 1), 365);
  const status = ['novo', 'orado', 'arquivado'].includes(req.query.status) ? req.query.status : undefined;
  const filtroCongregacao = await applyScopedCongregacaoFilter(req.user, {}, req.query.congregacao);
  const pedidos = await prayer.listarPedidos({ filtroCongregacao, dias, status });
  return res.json({ total: pedidos.length, pedidos });
};

const updateStatus = async (req, res) => {
  const { status } = req.body || {};
  if (!['novo', 'orado', 'arquivado'].includes(status)) return res.status(400).json({ message: 'Status inválido' });
  const pedido = await prayer.marcarStatus(req.params.id, status, req.user.nome);
  if (!pedido) return res.status(404).json({ message: 'Pedido não encontrado' });
  return res.json(pedido);
};

module.exports = { sendPrayer, listPrayers, updateStatus };
