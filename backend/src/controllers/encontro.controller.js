const GrupoEncontro = require('../models/GrupoEncontro.model');
const Encontro = require('../models/Encontro.model');
const Person = require('../models/Person.model');
const encontros = require('../services/encontro.service');
const engagement = require('../services/engagement.service');
const { canEditAula } = require('../services/ebd.service');
const { applyScopedCongregacaoFilter, canAccessCongregacao, resolveWritableCongregacao } = require('../utils/access');
const { toLocal } = require('../utils/phone');

const forbidden = (res) => res.status(403).json({ message: 'Sem acesso a esta congregação' });

const loadGrupo = async (req, res) => {
  const grupo = await GrupoEncontro.findById(req.params.id);
  if (!grupo) { res.status(404).json({ message: 'Grupo não encontrado' }); return null; }
  if (!(await canAccessCongregacao(req.user, grupo.congregacao))) { forbidden(res); return null; }
  return grupo;
};

const loadEncontro = async (req, res) => {
  const encontro = await Encontro.findById(req.params.id);
  if (!encontro) { res.status(404).json({ message: 'Encontro não encontrado' }); return null; }
  if (!(await canAccessCongregacao(req.user, encontro.congregacao))) { forbidden(res); return null; }
  return encontro;
};

const normalizeLideres = (lideres = []) => lideres
  .filter((l) => l && (l.nome || l.celular))
  .map((l) => ({ personId: l.personId || undefined, nome: l.nome, celular: l.celular ? toLocal(l.celular) : undefined, papel: l.papel }));

const GRUPO_FIELDS = ['nome', 'tipo', 'descricao', 'diaSemana', 'horario', 'local', 'criterios', 'convocarChamada', 'horaChamada', 'ativo', 'ebdClasses'];

// ── Grupos ──────────────────────────────────────────────────────────────
const listGrupos = async (req, res) => {
  const filter = await applyScopedCongregacaoFilter(req.user, req.query.todos ? {} : { ativo: true }, req.query.congregacao);
  const grupos = await GrupoEncontro.find(filter).sort({ congregacao: 1, nome: 1 }).lean();
  const ultimos = await Encontro.aggregate([
    { $match: { grupoId: { $in: grupos.map((g) => g._id) } } },
    { $sort: { data: -1 } },
    { $group: { _id: '$grupoId', data: { $first: '$data' }, presentes: { $first: { $size: { $filter: { input: '$presencas', cond: '$$this.presente' } } } }, total: { $first: { $size: '$presencas' } }, encontros: { $sum: 1 } } },
  ]);
  const porGrupo = new Map(ultimos.map((u) => [String(u._id), u]));
  res.json(grupos.map((g) => ({
    ...g,
    totalMembros: g.membros?.length || 0,
    membros: undefined,
    ultimoEncontro: porGrupo.get(String(g._id)) || null,
  })));
};

const getGrupo = async (req, res) => {
  const grupo = await loadGrupo(req, res);
  if (grupo) res.json(grupo);
};

const createGrupo = async (req, res) => {
  const b = req.body || {};
  const congregacao = await resolveWritableCongregacao(req.user, b.congregacao);
  if (!b.nome || !congregacao) return res.status(400).json({ message: 'Informe o nome e a congregação' });
  try {
    const grupo = new GrupoEncontro({
      ...Object.fromEntries(GRUPO_FIELDS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])),
      congregacao,
      lideres: normalizeLideres(b.lideres),
      criadoPor: req.user._id,
    });
    if (!b.ebdClasses && encontros.EBD_PADRAO[grupo.tipo]) grupo.ebdClasses = encontros.EBD_PADRAO[grupo.tipo];
    await grupo.save();
    const adicionados = (b.criterios?.sexo || b.criterios?.idadeMin || b.criterios?.tipos?.length) ? await encontros.syncMembers(grupo) : 0;
    const aulasEbd = await encontros.syncGrupoEbd(grupo);
    return res.status(201).json({ ...grupo.toJSON(), adicionados, aulasEbd });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Já existe um grupo com esse nome nesta congregação' });
    return res.status(400).json({ message: err.message });
  }
};

const updateGrupo = async (req, res) => {
  const grupo = await loadGrupo(req, res);
  if (!grupo) return undefined;
  const b = req.body || {};
  GRUPO_FIELDS.forEach((k) => { if (b[k] !== undefined) grupo[k] = b[k]; });
  if (b.lideres) grupo.lideres = normalizeLideres(b.lideres);
  if (b.congregacao && b.congregacao !== grupo.congregacao) grupo.congregacao = await resolveWritableCongregacao(req.user, b.congregacao);
  await grupo.save();
  await encontros.syncGrupoEbd(grupo);
  return res.json(grupo);
};

const syncMembros = async (req, res) => {
  const grupo = await loadGrupo(req, res);
  if (!grupo) return undefined;
  const adicionados = await encontros.syncMembers(grupo);
  return res.json({ adicionados, totalMembros: grupo.membros.length });
};

const addMembro = async (req, res) => {
  const grupo = await loadGrupo(req, res);
  if (!grupo) return undefined;
  const person = await Person.findById(req.body?.personId).select('nome celular congregacao').lean();
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  if (!grupo.membros.some((m) => String(m.personId) === String(person._id))) {
    grupo.membros.push({ personId: person._id, nome: person.nome, celular: person.celular });
    await grupo.save();
  }
  return res.json({ totalMembros: grupo.membros.length, membros: grupo.membros });
};

const removeMembro = async (req, res) => {
  const grupo = await loadGrupo(req, res);
  if (!grupo) return undefined;
  grupo.membros = grupo.membros.filter((m) => String(m.personId) !== req.params.personId);
  await grupo.save();
  return res.json({ totalMembros: grupo.membros.length, membros: grupo.membros });
};

const frequencia = async (req, res) => {
  const grupo = await loadGrupo(req, res);
  if (!grupo) return undefined;
  const stats = await engagement.encontroAttendance({ grupoId: grupo._id, weeks: Number(req.query.semanas) || 16, incluirEbd: true });
  const byId = new Map(stats.map((s) => [s.personId, s]));
  return res.json(grupo.membros.map((m) => ({
    personId: m.personId, nome: m.nome, celular: m.celular,
    ...(byId.get(String(m.personId)) || { totalAulas: 0, presencas: 0, taxaPresenca: 0, faltasConsecutivas: 0, nivel: null }),
  })).sort((a, b) => (b.faltasConsecutivas || 0) - (a.faltasConsecutivas || 0) || String(a.nome).localeCompare(b.nome)));
};

// ── Encontros ───────────────────────────────────────────────────────────
const listEncontros = async (req, res) => {
  const grupo = await loadGrupo(req, res);
  if (!grupo) return undefined;
  const lista = await Encontro.find({ grupoId: grupo._id }).sort({ data: -1 }).limit(100).select('-fotoUrl').lean();
  return res.json(lista.map((e) => ({ ...e, totalPresentes: e.presencas.filter((p) => p.presente).length, total: e.presencas.length, presencas: undefined })));
};

const createEncontro = async (req, res) => {
  const grupo = await loadGrupo(req, res);
  if (!grupo) return undefined;
  if (grupo.tipo === 'ebd') return res.status(400).json({ message: 'Aulas da EBD são registradas no menu EBD e aparecem aqui automaticamente.' });
  const { data, atividade, tema, descricao } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) return res.status(400).json({ message: 'Data inválida (AAAA-MM-DD)' });
  if (!grupo.membros.length) return res.status(400).json({ message: 'O grupo ainda não tem membros' });
  const { encontro, criado } = await encontros.findOrCreateEncontro({ grupo, isoDate: data, atividade, tema, descricao, userId: req.user._id });
  if (!criado) return res.status(409).json({ message: 'Já existe esse encontro nesta data', encontro });
  return res.status(201).json(encontro);
};

const getEncontro = async (req, res) => {
  const encontro = await loadEncontro(req, res);
  if (encontro) res.json(encontro);
};

const updateEncontro = async (req, res) => {
  const encontro = await loadEncontro(req, res);
  if (!encontro) return undefined;
  if (!canEditAula(encontro, req.user.role)) return res.status(403).json({ message: 'Edição bloqueada após 7 dias' });
  ['tema', 'descricao', 'atividade', 'fotoUrl'].forEach((k) => { if (req.body?.[k] !== undefined) encontro[k] = req.body[k]; });
  await encontro.save();
  return res.json(encontro);
};

const updatePresencas = async (req, res) => {
  const encontro = await loadEncontro(req, res);
  if (!encontro) return undefined;
  if (encontro.ebdAulaId) return res.status(400).json({ message: 'Edite a chamada desta aula no menu EBD.' });
  if (!canEditAula(encontro, req.user.role)) return res.status(403).json({ message: 'Edição bloqueada após 7 dias' });
  encontro.presencas = (req.body?.presencas || []).map((p) => ({ personId: p.personId, nome: p.nome, presente: Boolean(p.presente), justificativa: p.justificativa }));
  encontro.ausenciasProcessadasEm = undefined; // reprocessa ausências (idempotente por pessoa)
  await encontro.save();
  return res.json(encontro);
};

const removeEncontro = async (req, res) => {
  const encontro = await loadEncontro(req, res);
  if (!encontro) return undefined;
  await Encontro.deleteOne({ _id: encontro._id });
  return res.json({ message: 'Encontro removido' });
};

const processar = async (req, res) => {
  const encontro = await loadEncontro(req, res);
  if (!encontro) return undefined;
  return res.json(await engagement.processEncontro(encontro, { force: true }));
};

module.exports = {
  listGrupos, getGrupo, createGrupo, updateGrupo, syncMembros, addMembro, removeMembro, frequencia,
  listEncontros, createEncontro, getEncontro, updateEncontro, updatePresencas, removeEncontro, processar,
};
