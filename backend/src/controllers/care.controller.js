const { hasFeature } = require('../config/plans');
const CareAlert = require('../models/CareAlert.model');
const EbdAula = require('../models/EbdAula.model');
const Person = require('../models/Person.model');
const engagement = require('../services/engagement.service');
const generators = require('../services/ai/generators');
const { getUserCongregacoes, canAccessCongregacao, findAccessiblePerson } = require('../utils/access');

// null = todas; string = uma; array = as congregações liberadas ao admin.
const scopeCongregacao = async (req) => {
  const pedida = req.query.congregacao && req.query.congregacao !== 'Todos' ? req.query.congregacao : null;
  const lista = await getUserCongregacoes(req.user);
  if (!lista) return pedida;
  if (pedida && lista.includes(pedida)) return pedida;
  return lista.length === 1 ? lista[0] : lista;
};

const assertAlertScope = async (req, alert) => {
  if (!alert) return false;
  if (req.user.role === 'master') return true;
  return canAccessCongregacao(req.user, alert.congregacao);
};

const overview = async (req, res) => {
  const congregacao = await scopeCongregacao(req);
  res.json(await engagement.overview({ congregacao: congregacao || undefined }));
};

const listAlerts = async (req, res) => {
  const congregacao = await scopeCongregacao(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (congregacao) filter.congregacao = Array.isArray(congregacao) ? { $in: congregacao } : congregacao;
  res.json(await CareAlert.find(filter).sort({ updatedAt: -1 }).limit(200).lean());
};

const updateAlert = async (req, res) => {
  const alert = await CareAlert.findById(req.params.id);
  if (!(await assertAlertScope(req, alert))) return res.status(404).json({ message: 'Alerta não encontrado' });
  const { status, acao } = req.body || {};
  if (acao?.tipo) alert.acoes.push({ tipo: acao.tipo, canal: acao.canal, descricao: acao.descricao, por: req.user.nome });
  if (status) {
    alert.status = status;
    if (status === 'resolvido') alert.resolvidoEm = new Date();
  } else if (acao?.tipo && alert.status === 'aberto') {
    alert.status = 'em_contato';
  }
  await alert.save();
  res.json(alert);
};

const generateMessage = async (req, res) => {
  if (!hasFeature(req.tenant, 'reengajamento')) return res.status(403).json({ message: 'Mensagens com IA disponíveis a partir do plano Crescer.' });
  const alert = await CareAlert.findById(req.params.id);
  if (!(await assertAlertScope(req, alert))) return res.status(404).json({ message: 'Alerta não encontrado' });
  const aula = await EbdAula.findOne({ 'presencas.personId': alert.personId }).sort({ data: -1 }).lean();
  alert.mensagemSugerida = await generators.mensagemAusente({ pessoa: { nome: alert.nome }, aula, faltas: alert.faltasConsecutivas || 1 });
  await alert.save();
  res.json({ mensagem: alert.mensagemSugerida });
};

const sendMessage = async (req, res) => {
  const alert = await CareAlert.findById(req.params.id);
  if (!(await assertAlertScope(req, alert))) return res.status(404).json({ message: 'Alerta não encontrado' });
  const mensagem = String(req.body?.mensagem || alert.mensagemSugerida || '').trim();
  if (!mensagem) return res.status(400).json({ message: 'Mensagem vazia' });
  const person = await Person.findById(alert.personId).select('nome celular email').lean();
  if (!person?.celular) return res.status(400).json({ message: 'Pessoa sem celular cadastrado' });
  const ok = await engagement.sendAbsenceMessage({ person, mensagem, aula: null, alert, faltas: alert.faltasConsecutivas || 1 });
  if (!ok) return res.status(502).json({ message: 'Falha ao enviar pelo WhatsApp' });
  alert.acoes[alert.acoes.length - 1].por = req.user.nome;
  await alert.save();
  return res.json(alert);
};

const processAula = async (req, res) => {
  const aula = await EbdAula.findById(req.params.id).select('congregacao').lean();
  if (!aula) return res.status(404).json({ message: 'Aula não encontrada' });
  if (!(await canAccessCongregacao(req.user, aula.congregacao))) {
    return res.status(403).json({ message: 'Aula de outra congregação' });
  }
  const resumo = await engagement.processAula(req.params.id, { force: true });
  if (!resumo) return res.status(404).json({ message: 'Aula não encontrada' });
  return res.json(resumo);
};

const personHistory = async (req, res) => {
  await findAccessiblePerson(req.user, req.params.id, 'congregacao');
  const aulas = await EbdAula.find({ 'presencas.personId': req.params.id }).sort({ data: -1 }).limit(26)
    .select('data classe congregacao tema presencas').lean();
  const historico = aulas.map((a) => ({
    data: a.data,
    classe: a.classe,
    tema: a.tema,
    presente: a.presencas.find((p) => String(p.personId) === req.params.id)?.presente ?? false,
  }));
  const alertas = await CareAlert.find({ personId: req.params.id }).sort({ createdAt: -1 }).lean();
  res.json({ historico, alertas });
};

module.exports = { overview, listAlerts, updateAlert, generateMessage, sendMessage, processAula, personHistory };
