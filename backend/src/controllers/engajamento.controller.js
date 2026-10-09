const Campanha = require('../models/Campanha.model');
const Evento = require('../models/Evento.model');
const Person = require('../models/Person.model');
const campanhaSvc = require('../services/campanha.service');
const eventoSvc = require('../services/evento.service');
const sermaoSvc = require('../services/sermao.service');
const celulaSvc = require('../services/celula.service');
const impactoSvc = require('../services/impacto.service');
const templates = require('../templates/messages.templates');
const whatsapp = require('../services/whatsapp.service');
const { applyScopedCongregacaoFilter, resolveWritableCongregacao } = require('../utils/access');
const { toLocal } = require('../utils/phone');

const escopo = (req, extra = {}) => applyScopedCongregacaoFilter(req.user, extra, req.query.congregacao);
const TIPOS_PESSOA = ['membro', 'congregado', 'visitante', 'novo decidido', 'criança'];
const isoDia = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').slice(0, 10)) ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`) : null);

// ── Campanhas ───────────────────────────────────────────────────────────
const listarCampanhas = async (req, res) => {
  const filtro = req.user.role === 'master' ? {} : { criadoPor: req.user._id };
  const lista = await Campanha.find(filtro).sort({ createdAt: -1 }).limit(60).lean();
  res.json(lista.map(campanhaSvc.resumo));
};

const publicoDoBody = async (req, b) => {
  const tipos = (b.tipos || []).filter((t) => TIPOS_PESSOA.includes(t));
  const congregacao = b.congregacao ? await resolveWritableCongregacao(req.user, b.congregacao) : undefined;
  const escopoAdmin = req.user.role === 'master' ? undefined : (await applyScopedCongregacaoFilter(req.user, {})).congregacao;
  return { congregacao, congregacoes: !congregacao && escopoAdmin?.$in ? escopoAdmin.$in : undefined, tipos, descricao: congregacao || 'toda a igreja' };
};

const previaPublico = async (req, res) => {
  const lista = await campanhaSvc.montarPublico(await publicoDoBody(req, { congregacao: req.query.congregacao, tipos: String(req.query.tipos || '').split(',').filter(Boolean) }));
  res.json({ total: lista.length, recebem: lista.filter((d) => d.status === 'pendente').length, descadastrados: lista.filter((d) => d.status === 'bloqueado').length });
};

const criarCampanha = async (req, res) => {
  const b = req.body || {};
  if (!b.titulo || !b.texto) return res.status(400).json({ message: 'Informe o título e o texto' });
  if (String(b.texto).length > 3500) return res.status(400).json({ message: 'Texto muito longo (máx. 3.500 caracteres)' });
  const enviarApos = b.enviarApos ? new Date(b.enviarApos) : new Date();
  if (Number.isNaN(enviarApos.getTime())) return res.status(400).json({ message: 'Data de envio inválida' });
  const tipo = b.tipo === 'sermao' ? 'sermao' : 'aviso';
  const texto = tipo === 'sermao' ? templates.sermaoMembro(b.texto) : `Olá, {nome}! 👋\n\n${b.texto}`;
  const me = req.user.personId ? await Person.findById(req.user.personId).select('celular').lean() : null;
  const c = await campanhaSvc.criar({ tipo, titulo: String(b.titulo).slice(0, 120), texto, publico: await publicoDoBody(req, b), enviarApos, user: req.user, avisarCelular: me?.celular });
  res.status(201).json(campanhaSvc.resumo(c));
};

const cancelarCampanha = async (req, res) => {
  const filtro = req.user.role === 'master' ? { _id: req.params.id } : { _id: req.params.id, criadoPor: req.user._id };
  if (!(await Campanha.exists(filtro))) return res.status(404).json({ message: 'Campanha não encontrada' });
  const c = await campanhaSvc.cancelar(req.params.id);
  if (!c) return res.status(400).json({ message: 'Esta campanha já terminou' });
  res.json(campanhaSvc.resumo(c));
};

const organizarSermao = async (req, res) => {
  const relato = String(req.body?.relato || '').trim();
  if (relato.length < 30) return res.status(400).json({ message: 'Conte um pouco mais do sermão (mínimo 30 caracteres)' });
  res.json({ texto: await sermaoSvc.organizarSermao(relato.slice(0, 8000), { pregador: req.user.nome }) });
};

// ── Eventos ─────────────────────────────────────────────────────────────
const dadosEvento = async (req, b) => {
  const data = isoDia(b.data);
  if (!b.titulo || !data) throw Object.assign(new Error('Informe o título e a data'), { status: 400 });
  return {
    titulo: String(b.titulo).trim().slice(0, 100), descricao: b.descricao ? String(b.descricao).slice(0, 1500) : undefined,
    data, horario: b.horario || undefined, local: b.local ? String(b.local).slice(0, 150) : undefined,
    congregacao: b.congregacao ? await resolveWritableCongregacao(req.user, b.congregacao) : undefined,
    vagas: Number(b.vagas) > 0 ? Math.floor(Number(b.vagas)) : undefined,
    valor: Number(b.valor) > 0 ? Math.round(Number(b.valor) * 100) / 100 : 0,
    inscricoesAbertas: b.inscricoesAbertas !== false,
  };
};
const findEvento = async (req) => Evento.findOne(await escopo(req, { _id: req.params.id }));

const listarEventos = async (req, res) => {
  const passados = req.query.passados === '1';
  const filtro = await escopo(req, { cancelado: { $ne: true }, data: passados ? { $lt: new Date() } : { $gte: new Date(Date.now() - 864e5) } });
  const eventos = await Evento.find(filtro).sort({ data: passados ? -1 : 1 }).limit(60);
  res.json({ eventos: eventos.map(eventoSvc.resumo), pixConfigurado: eventoSvc.pixPronto() });
};
const criarEvento = async (req, res) => {
  const e = await eventoSvc.criar(await dadosEvento(req, req.body || {}), req.user);
  res.status(201).json(eventoSvc.resumo(e));
};
const atualizarEvento = async (req, res) => {
  const e = await findEvento(req);
  if (!e) return res.status(404).json({ message: 'Evento não encontrado' });
  Object.assign(e, await dadosEvento(req, { ...e.toObject(), ...req.body, data: req.body.data || e.data.toISOString() }));
  if (req.body.cancelado === true) e.cancelado = true;
  await e.save();
  res.json(eventoSvc.resumo(e));
};
const detalheEvento = async (req, res) => {
  const e = await findEvento(req);
  if (!e) return res.status(404).json({ message: 'Evento não encontrado' });
  res.json({ ...eventoSvc.resumo(e), descricao: e.descricao, inscricoes: e.inscricoes.filter((i) => i.status !== 'cancelado') });
};
const inscreverWeb = async (req, res) => {
  const e = await findEvento(req);
  if (!e) return res.status(404).json({ message: 'Evento não encontrado' });
  const p = req.body.personId ? await Person.findById(req.body.personId).select('nome celular').lean() : null;
  const nome = p?.nome || String(req.body.nome || '').trim();
  if (!nome) return res.status(400).json({ message: 'Escolha a pessoa ou informe o nome' });
  const r = await eventoSvc.inscrever(e, { personId: p?._id, nome, celular: p?.celular || (req.body.celular ? toLocal(req.body.celular) : undefined), origem: 'web' });
  res.status(r.nova ? 201 : 200).json({ inscricao: r.inscricao, nova: r.nova });
};
const atualizarInscricao = async (req, res) => {
  const e = await findEvento(req);
  const insc = e?.inscricoes.id(req.params.iid);
  if (!insc) return res.status(404).json({ message: 'Inscrição não encontrada' });
  const status = req.body.status;
  if (!['inscrito', 'pago', 'cancelado', 'espera'].includes(status)) return res.status(400).json({ message: 'Status inválido' });
  const antes = insc.status;
  insc.status = status;
  if (status === 'pago') { insc.pagoEm = new Date(); insc.confirmadoPor = req.user.nome; }
  await e.save();
  if (status === 'pago' && antes !== 'pago' && insc.celular) {
    whatsapp.sendText(insc.celular, templates.eventoPagamentoConfirmado(insc.nome, e.titulo)).catch(() => {});
  }
  if (status === 'cancelado' && eventoSvc.ATIVOS.includes(antes)) {
    const prox = await eventoSvc.promoverEspera(e);
    if (prox?.celular) whatsapp.sendText(prox.celular, templates.eventoVagaLiberada(prox.nome, e.titulo)).catch(() => {});
  }
  res.json({ ok: true, inscricao: insc });
};
const divulgarEvento = async (req, res) => {
  const e = await findEvento(req);
  if (!e) return res.status(404).json({ message: 'Evento não encontrado' });
  const me = req.user.personId ? await Person.findById(req.user.personId).select('celular').lean() : null;
  const c = await campanhaSvc.criar({
    tipo: 'evento', titulo: `Divulgação: ${e.titulo}`, texto: templates.eventoDivulgacao(eventoSvc.resumo(e)), eventoId: e._id,
    publico: await publicoDoBody(req, { congregacao: req.body.congregacao || e.congregacao, tipos: req.body.tipos || sermaoSvc.PUBLICO_TIPOS }),
    enviarApos: req.body.enviarApos ? new Date(req.body.enviarApos) : new Date(), user: req.user, avisarCelular: me?.celular,
  });
  res.status(201).json(campanhaSvc.resumo(c));
};
const pixPreview = async (req, res) => {
  const e = await findEvento(req);
  if (!e) return res.status(404).json({ message: 'Evento não encontrado' });
  if (!e.valor) return res.json({ pix: null, motivo: 'Evento gratuito' });
  if (!eventoSvc.pixPronto()) return res.json({ pix: null, motivo: 'Configure a chave Pix, o nome do recebedor e a cidade da igreja em Configurações → Igreja' });
  res.json({ pix: await eventoSvc.pixDaInscricao(e, { _id: e._id, txid: `${e.codigo}TESTE` }) });
};

// ── Intercessores ───────────────────────────────────────────────────────
const listarIntercessores = async (req, res) => {
  res.json(await Person.find(await escopo(req, { intercessor: true, status: 'ativo' })).select('nome celular congregacao').sort({ nome: 1 }).lean());
};
const marcarIntercessor = async (req, res) => {
  const p = await Person.findOneAndUpdate(await escopo(req, { _id: req.params.personId }), { $set: { intercessor: req.body?.intercessor !== false } }, { new: true }).select('nome intercessor').lean();
  if (!p) return res.status(404).json({ message: 'Pessoa não encontrada' });
  res.json(p);
};

// ── Células e impacto ───────────────────────────────────────────────────
const painelCelulas = async (req, res) => res.json(await celulaSvc.painel(await escopo(req)));
const impacto = async (req, res) => {
  const mes = /^\d{4}-\d{2}$/.test(String(req.query.mes || '')) ? req.query.mes : undefined;
  res.json(await impactoSvc.comComparativo(mes, await escopo(req)));
};

module.exports = {
  listarCampanhas, previaPublico, criarCampanha, cancelarCampanha, organizarSermao,
  listarEventos, criarEvento, atualizarEvento, detalheEvento, inscreverWeb, atualizarInscricao, divulgarEvento, pixPreview,
  listarIntercessores, marcarIntercessor, painelCelulas, impacto,
};
