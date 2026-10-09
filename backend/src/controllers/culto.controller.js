const Culto = require('../models/Culto.model');
const Person = require('../models/Person.model');
const cultoSvc = require('../services/culto.service');
const { applyScopedCongregacaoFilter, resolveWritableCongregacao } = require('../utils/access');
const { hasFeature } = require('../config/plans');

const featureOk = (req, res) => {
  if (hasFeature(req.tenant, 'checkinCulto')) return true;
  res.status(403).json({ message: 'Check-in de culto não disponível no seu plano.' });
  return false;
};

const findScoped = async (req) => Culto.findOne(await applyScopedCongregacaoFilter(req.user, { _id: req.params.id }));

const detalhe = async (c) => ({
  ...cultoSvc.resumo(c),
  link: cultoSvc.numeroBot() ? cultoSvc.linkCheckin(c) : null,
  qr: cultoSvc.numeroBot() ? await cultoSvc.qrDataUrl(c, 900) : null,
  presencas: [...c.presencas].sort((a, b) => new Date(b.em) - new Date(a.em)),
});

const list = async (req, res) => {
  if (!featureOk(req, res)) return undefined;
  const dias = Math.min(Number(req.query.dias) || 60, 365);
  const filter = await applyScopedCongregacaoFilter(req.user, { data: { $gte: new Date(Date.now() - dias * 864e5) } }, req.query.congregacao);
  const cultos = await Culto.find(filter).sort({ data: -1, createdAt: -1 }).limit(100).lean();
  return res.json({ cultos: cultos.map(cultoSvc.resumo), numeroConfigurado: Boolean(cultoSvc.numeroBot()) });
};

const abrir = async (req, res) => {
  if (!featureOk(req, res)) return undefined;
  const congregacao = await resolveWritableCongregacao(req.user, req.body?.congregacao);
  if (!congregacao) return res.status(400).json({ message: 'Informe a congregação' });
  const titulo = String(req.body?.titulo || 'Culto').trim().slice(0, 80) || 'Culto';
  const { culto, criado } = await cultoSvc.abrirCulto({ congregacao, titulo, userId: req.user._id, userNome: req.user.nome });
  return res.status(criado ? 201 : 200).json(await detalhe(culto));
};

const get = async (req, res) => {
  const c = await findScoped(req);
  if (!c) return res.status(404).json({ message: 'Culto não encontrado' });
  return res.json(await detalhe(c));
};

const encerrar = async (req, res) => {
  const c = await findScoped(req);
  if (!c) return res.status(404).json({ message: 'Culto não encontrado' });
  c.aberto = false;
  await c.save();
  return res.json(cultoSvc.resumo(c));
};

// Presença marcada pela recepção (quem não tem celular, por exemplo).
const addPresenca = async (req, res) => {
  const c = await findScoped(req);
  if (!c) return res.status(404).json({ message: 'Culto não encontrado' });
  const person = await Person.findById(req.body?.personId).lean();
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  await cultoSvc.registrarPresenca(c, person, { via: 'web' });
  return res.json(await detalhe(c));
};

module.exports = { list, abrir, get, encerrar, addPresenca };
