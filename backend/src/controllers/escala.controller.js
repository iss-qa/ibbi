const Escala = require('../models/Escala.model');
const Person = require('../models/Person.model');
const escalaSvc = require('../services/escala.service');
const { applyScopedCongregacaoFilter, resolveWritableCongregacao } = require('../utils/access');
const { hasFeature } = require('../config/plans');

const featureOk = (req, res) => {
  if (hasFeature(req.tenant, 'escalas')) return true;
  res.status(403).json({ message: 'Escalas não disponíveis no seu plano.' });
  return false;
};
const findScoped = async (req) => Escala.findOne(await applyScopedCongregacaoFilter(req.user, { _id: req.params.id }));
const isoDia = (v) => {
  const iso = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : null;
};
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Itens { funcao, personId } → com nome/celular do cadastro (só pessoas ativas).
const montarItens = async (itens = []) => {
  const validos = itens.filter((i) => i?.funcao && i?.personId).slice(0, 50);
  const pessoas = await Person.find({ _id: { $in: validos.map((i) => i.personId) }, status: 'ativo' }).select('nome celular').lean();
  const porId = new Map(pessoas.map((p) => [String(p._id), p]));
  return validos.filter((i) => porId.has(String(i.personId))).map((i) => {
    const p = porId.get(String(i.personId));
    return { funcao: String(i.funcao).trim().slice(0, 60), personId: p._id, nome: p.nome, celular: p.celular };
  });
};

const list = async (req, res) => {
  if (!featureOk(req, res)) return undefined;
  const passadas = req.query.passadas === '1';
  const hoje = new Date(new Date().toISOString().slice(0, 10));
  const filter = await applyScopedCongregacaoFilter(req.user, {
    cancelada: { $ne: true },
    data: passadas ? { $gte: new Date(hoje.getTime() - 60 * 864e5), $lt: hoje } : { $gte: hoje },
  }, req.query.congregacao);
  const escalas = await Escala.find(filter).sort({ data: passadas ? -1 : 1, horario: 1 }).limit(100).lean();
  return res.json(escalas);
};

const create = async (req, res) => {
  if (!featureOk(req, res)) return undefined;
  const b = req.body || {};
  const data = isoDia(b.data);
  if (!b.ministerio || !data) return res.status(400).json({ message: 'Informe o ministério e a data' });
  if (b.horario && !HORA_RE.test(b.horario)) return res.status(400).json({ message: 'Horário inválido (HH:MM)' });
  const congregacao = await resolveWritableCongregacao(req.user, b.congregacao);
  const itens = await montarItens(b.itens);
  if (!itens.length) return res.status(400).json({ message: 'Adicione ao menos uma pessoa à escala' });
  const resp = b.responsavelId ? await Person.findById(b.responsavelId).select('nome celular').lean() : null;
  const euPessoa = req.user.personId ? await Person.findById(req.user.personId).select('nome celular').lean() : null;
  const responsavel = resp || euPessoa;
  const escala = await Escala.create({
    ministerio: String(b.ministerio).trim().slice(0, 60), evento: String(b.evento || 'Culto').trim().slice(0, 80),
    congregacao, data, horario: b.horario || undefined, observacao: b.observacao ? String(b.observacao).slice(0, 500) : undefined,
    itens, criadoPor: req.user._id,
    responsavelId: responsavel?._id, responsavelNome: responsavel?.nome, responsavelCelular: responsavel?.celular,
  });
  const enviados = b.enviar ? await escalaSvc.enviarConvites(escala._id) : 0;
  return res.status(201).json({ escala, enviados });
};

const enviarConvites = async (req, res) => {
  const e = await findScoped(req);
  if (!e) return res.status(404).json({ message: 'Escala não encontrada' });
  const enviados = await escalaSvc.enviarConvites(e._id);
  return res.json({ enviados });
};

const addItem = async (req, res) => {
  const e = await findScoped(req);
  if (!e) return res.status(404).json({ message: 'Escala não encontrada' });
  const [item] = await montarItens([req.body]);
  if (!item) return res.status(400).json({ message: 'Informe a função e uma pessoa ativa' });
  e.itens.push(item);
  await e.save();
  const novo = e.itens[e.itens.length - 1];
  if (req.body.enviar) await escalaSvc.enviarConvites(e._id, { itemIds: [String(novo._id)] });
  return res.json(await Escala.findById(e._id).lean());
};

const removeItem = async (req, res) => {
  const e = await findScoped(req);
  if (!e) return res.status(404).json({ message: 'Escala não encontrada' });
  e.itens.pull({ _id: req.params.itemId });
  await e.save();
  return res.json(e);
};

const cancelar = async (req, res) => {
  const e = await findScoped(req);
  if (!e) return res.status(404).json({ message: 'Escala não encontrada' });
  e.cancelada = true;
  await e.save();
  return res.json({ ok: true });
};

const sugestoes = async (req, res) => {
  const e = await findScoped(req);
  if (!e) return res.status(404).json({ message: 'Escala não encontrada' });
  return res.json(await escalaSvc.sugestoesSubstituto(e, 8, req.query.funcao));
};

module.exports = { list, create, enviarConvites, addItem, removeItem, cancelar, sugestoes };
