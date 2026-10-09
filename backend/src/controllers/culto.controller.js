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
  // Convite com frase sorteada a cada abertura (sem contagem de presentes)
  convite: cultoSvc.numeroBot() ? { texto: cultoSvc.conviteCheckin(c), link: cultoSvc.linkCompartilhar(c) } : null,
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
  // Em segundo plano: a resposta não espera a fila do WhatsApp
  if (criado) cultoSvc.avisarLideranca(culto).catch((err) => console.warn('[CULTO] Falha ao avisar a liderança:', err.message));
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

// Reenvia o QR e o convite para a liderança (botão na tela do culto).
const enviarLideranca = async (req, res) => {
  const c = await findScoped(req);
  if (!c) return res.status(404).json({ message: 'Culto não encontrado' });
  if (!c.aberto) return res.status(400).json({ message: 'Este check-in já foi encerrado.' });
  if (!cultoSvc.numeroBot()) return res.status(400).json({ message: 'Informe o número do WhatsApp da igreja em Configurações → WhatsApp.' });
  // botão manual vale mesmo com o envio automático desligado
  const r = await cultoSvc.avisarLideranca(c, { forcar: true });
  if (!r.destinatarios) return res.status(400).json({ message: 'Nenhum contato da liderança com WhatsApp. Cadastre em Configurações → Liderança.' });
  return res.json(r);
};

// Presença marcada pela recepção (quem não tem celular, por exemplo).
const addPresenca = async (req, res) => {
  const c = await findScoped(req);
  if (!c) return res.status(404).json({ message: 'Culto não encontrado' });
  const person = await Person.findOne(await applyScopedCongregacaoFilter(req.user, { _id: String(req.body?.personId || '') })).lean();
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  await cultoSvc.registrarPresenca(c, person, { via: 'web' });
  return res.json(await detalhe(c));
};

module.exports = { list, abrir, get, encerrar, addPresenca, enviarLideranca };
