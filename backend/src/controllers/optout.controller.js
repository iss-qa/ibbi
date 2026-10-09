const OptOut = require('../models/OptOut.model');
const optout = require('../services/optout.service');
const { toLocal } = require('../utils/phone');

// Descadastrados do WhatsApp (SAIR). Reativar exige justificativa: o consentimento é da pessoa.
const list = async (req, res) => {
  const filtro = req.query.todos === '1' ? {} : { ativo: true };
  const itens = await OptOut.find(filtro).sort({ desde: -1 }).limit(500).lean();
  return res.json(itens);
};

// A pessoa pediu pessoalmente / por outro canal para não receber mensagens.
const registrar = async (req, res) => {
  const numero = toLocal(req.body?.celular);
  if (numero.length < 10) return res.status(400).json({ message: 'Informe o celular com DDD' });
  const doc = await optout.sair(numero, { origem: 'lider', por: req.user.nome, detalhe: String(req.body?.motivo || 'pedido registrado pela liderança').slice(0, 300) });
  return res.status(201).json(doc);
};

const reativar = async (req, res) => {
  const justificativa = String(req.body?.justificativa || '').trim();
  if (justificativa.length < 10) {
    return res.status(400).json({ message: 'Explique como a pessoa pediu para voltar a receber (mín. 10 caracteres). Sem o pedido dela, não reative.' });
  }
  const atual = await OptOut.findById(req.params.id).lean();
  if (!atual) return res.status(404).json({ message: 'Registro não encontrado' });
  const doc = await optout.voltar(atual.chave, { origem: 'lider', por: req.user.nome, detalhe: justificativa });
  return res.json(doc);
};

module.exports = { list, registrar, reativar };
