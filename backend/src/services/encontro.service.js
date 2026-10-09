const GrupoEncontro = require('../models/GrupoEncontro.model');
const Encontro = require('../models/Encontro.model');
const Person = require('../models/Person.model');
const { calculateAge } = require('../utils/person-rules');
const { samePhone } = require('../utils/phone');
const { dayRangeFromIso } = require('../utils/time');
const { getTenant } = require('../tenancy/context');

const ATIVIDADE_LABEL = {
  aula_ebd: 'Aula da EBD', culto: 'Culto', ensaio: 'Ensaio', reuniao: 'Reunião', estudo: 'Estudo bíblico', oracao: 'Oração',
  evangelismo: 'Evangelismo', visita: 'Visita', confraternizacao: 'Confraternização', outro: 'Encontro',
};

// Pessoas que atendem aos critérios do grupo (ex.: mulheres ativas da congregação, 18+).
const candidatesByCriteria = async (grupo) => {
  const c = grupo.criterios || {};
  const filter = { status: 'ativo', congregacao: grupo.congregacao };
  if (c.sexo) filter.sexo = c.sexo;
  if (c.tipos?.length) filter.tipo = { $in: c.tipos };
  const people = await Person.find(filter).select('nome celular dataNascimento').sort({ nome: 1 }).lean();
  return people.filter((p) => {
    if (!c.idadeMin && !c.idadeMax) return true;
    const idade = calculateAge(p.dataNascimento);
    if (idade === null) return !c.idadeMin; // sem data: entra só se não houver idade mínima
    return (!c.idadeMin || idade >= c.idadeMin) && (!c.idadeMax || idade <= c.idadeMax);
  });
};

/**
 * Compara o grupo com os critérios atuais: quem saiu dos critérios (com o motivo) e quem atende mas
 * ainda não está no grupo. Nada é alterado aqui; o líder confirma em aplicarRevisao.
 */
const revisarCriterios = async (grupo) => {
  const c = grupo.criterios || {};
  const candidatos = await candidatesByCriteria(grupo);
  const atendem = new Set(candidatos.map((p) => String(p._id)));
  const noGrupo = new Set(grupo.membros.map((m) => String(m.personId)));
  const lideres = new Set((grupo.lideres || []).map((l) => String(l.personId)));
  const foraIds = grupo.membros.filter((m) => !atendem.has(String(m.personId))).map((m) => m.personId);
  const pessoas = new Map((await Person.find({ _id: { $in: foraIds } }).select('status sexo dataNascimento congregacao tipo').lean())
    .map((p) => [String(p._id), p]));
  const motivo = (p) => {
    if (!p) return 'cadastro removido';
    if (p.status !== 'ativo') return 'inativo';
    if (p.congregacao !== grupo.congregacao) return `congregação ${p.congregacao || '—'}`;
    if (c.sexo && p.sexo !== c.sexo) return p.sexo ? p.sexo.toLowerCase() : 'sexo não informado';
    if (c.tipos?.length && !c.tipos.includes(p.tipo)) return p.tipo || 'tipo não informado';
    const idade = calculateAge(p.dataNascimento);
    return idade === null ? 'sem data de nascimento' : `${idade} anos`;
  };
  return {
    pelosCriterios: candidatos.length,
    fora: grupo.membros.filter((m) => !atendem.has(String(m.personId))).map((m) => ({
      personId: m.personId, nome: m.nome, manual: Boolean(m.manual), lider: lideres.has(String(m.personId)), motivo: motivo(pessoas.get(String(m.personId))),
    })).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')),
    faltando: candidatos.filter((p) => !noGrupo.has(String(p._id))).map((p) => ({ personId: p._id, nome: p.nome })),
  };
};

// Aplica a revisão confirmada: remove os escolhidos (só entre quem saiu dos critérios) e, se pedido, inclui quem falta.
const aplicarRevisao = async (grupo, { remover = [], adicionar = false } = {}) => {
  const rev = await revisarCriterios(grupo);
  const removiveis = new Set(rev.fora.map((f) => String(f.personId)));
  const tirar = new Set(remover.map(String).filter((id) => removiveis.has(id)));
  grupo.membros = grupo.membros.filter((m) => !tirar.has(String(m.personId)));
  let adicionados = 0;
  if (adicionar) {
    const candidatos = await candidatesByCriteria(grupo);
    const noGrupo = new Set(grupo.membros.map((m) => String(m.personId)));
    candidatos.filter((p) => !noGrupo.has(String(p._id))).forEach((p) => {
      grupo.membros.push({ personId: p._id, nome: p.nome, celular: p.celular });
      adicionados += 1;
    });
  }
  await grupo.save();
  return { removidos: tirar.size, adicionados, totalMembros: grupo.membros.length };
};

// Acrescenta ao grupo quem atende aos critérios (não remove ninguém).
const syncMembers = async (grupo) => {
  const atuais = new Set(grupo.membros.map((m) => String(m.personId)));
  const novos = (await candidatesByCriteria(grupo)).filter((p) => !atuais.has(String(p._id)));
  novos.forEach((p) => grupo.membros.push({ personId: p._id, nome: p.nome, celular: p.celular }));
  await grupo.save();
  return novos.length;
};

// Roster ordenado (a numeração é usada na chamada pelo WhatsApp).
const sortedMembers = (grupo) => [...(grupo.membros || [])]
  .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
  .map((m) => ({ _id: m.personId, nome: m.nome }));

const findEncontro = ({ grupoId, isoDate, atividade }) => Encontro.findOne({
  grupoId, data: dayRangeFromIso(isoDate), ...(atividade ? { atividade } : {}),
});

// Presença pré-populada com todos os membros, presente = true (mesma regra da EBD).
const findOrCreateEncontro = async ({ grupo, isoDate, atividade = 'reuniao', tema, descricao, userId, origem = 'web' }) => {
  const existing = await findEncontro({ grupoId: grupo._id, isoDate, atividade });
  if (existing) return { encontro: existing, criado: false };
  const encontro = await Encontro.create({
    grupoId: grupo._id,
    grupoNome: grupo.nome,
    congregacao: grupo.congregacao,
    data: new Date(`${isoDate}T12:00:00`),
    atividade,
    tema,
    descricao,
    origem,
    registradoPor: userId,
    presencas: sortedMembers(grupo).map((m) => ({ personId: m._id, nome: m.nome, presente: true })),
  });
  return { encontro, criado: true };
};

// Grupos em que o telefone é de um líder.
const gruposDoLider = async (phone) => {
  const grupos = await GrupoEncontro.find({ ativo: true, 'lideres.0': { $exists: true } }).select('nome congregacao lideres').lean();
  return grupos.filter((g) => g.lideres.some((l) => samePhone(l.celular, phone)))
    .map((g) => ({ id: String(g._id), nome: g.nome, congregacao: g.congregacao }));
};

const tenantCongregacoes = () => getTenant()?.congregacoes || [];

// ── EBD dentro dos grupos ───────────────────────────────────────────────
// Classe da EBD ligada por padrão a cada tipo de união.
const EBD_PADRAO = { uniao_jovens: ['Jovens'], uniao_adolescentes: ['Adolescentes'], uniao_criancas: ['Crianças'] };

const encontroFromAula = (grupo, aula) => ({
  grupoId: grupo._id, grupoNome: grupo.nome, congregacao: aula.congregacao, data: aula.data, atividade: 'aula_ebd',
  tema: aula.tema ? `EBD ${aula.classe} — ${aula.tema}` : `EBD ${aula.classe}`,
  descricao: aula.descricao, fotoUrl: aula.fotoUrl, origem: aula.origem || 'web',
  presencas: aula.presencas.map((p) => ({ personId: p.personId, nome: p.nome, presente: p.presente, justificativa: p.justificativa, motivo: p.motivo })),
  // A retenção da EBD já trata estas faltas: o espelho nunca dispara mensagens.
  ausenciasProcessadasEm: new Date(),
});

// Cada aula com chamada vira um encontro em todo grupo que conta aquela classe da EBD.
const syncAulaToEncontro = async (aulaId) => {
  const EbdAula = require('../models/EbdAula.model');
  const aula = await EbdAula.findById(aulaId).lean();
  if (!aula) return null;
  const grupos = aula.presencas?.length
    ? await GrupoEncontro.find({ ativo: true, congregacao: aula.congregacao, ebdClasses: aula.classe, tipo: { $ne: 'ebd' } }).lean()
    : [];
  await Encontro.deleteMany({ ebdAulaId: aula._id, grupoId: { $nin: grupos.map((g) => g._id) } });
  for (const grupo of grupos) {
    await Encontro.findOneAndUpdate({ ebdAulaId: aula._id, grupoId: grupo._id }, { $set: encontroFromAula(grupo, aula) }, { upsert: true });
  }
  return grupos.length;
};

// Após criar/editar um grupo: traz as aulas das classes ligadas (últimos 12 meses) e remove as desligadas.
const syncGrupoEbd = async (grupo) => {
  const EbdAula = require('../models/EbdAula.model');
  const classes = grupo.ebdClasses || [];
  const aulas = classes.length
    ? await EbdAula.find({ congregacao: grupo.congregacao, classe: { $in: classes }, data: { $gte: new Date(Date.now() - 365 * 864e5) }, 'presencas.0': { $exists: true } }).lean()
    : [];
  await Encontro.deleteMany({ grupoId: grupo._id, ebdAulaId: { $ne: null, $nin: aulas.map((a) => a._id) } });
  for (const aula of aulas) {
    await Encontro.findOneAndUpdate({ ebdAulaId: aula._id, grupoId: grupo._id }, { $set: encontroFromAula(grupo, aula) }, { upsert: true });
  }
  return aulas.length;
};

const removeAulaEncontro = (aulaId) => Encontro.deleteMany({ ebdAulaId: aulaId });

// Migração v2: remove os cards "EBD — <classe>" da v1 e liga a EBD às uniões por tipo.
const migrarEbdParaUnioes = async () => {
  const antigos = await GrupoEncontro.find({ tipo: 'ebd' }).select('_id').lean();
  if (antigos.length) {
    await Encontro.deleteMany({ grupoId: { $in: antigos.map((g) => g._id) } });
    await GrupoEncontro.deleteMany({ _id: { $in: antigos.map((g) => g._id) } });
  }
  let ligadas = 0;
  for (const grupo of await GrupoEncontro.find({ ativo: true })) {
    if (!grupo.ebdClasses?.length && EBD_PADRAO[grupo.tipo]) {
      grupo.ebdClasses = EBD_PADRAO[grupo.tipo];
      await grupo.save();
    }
    if (grupo.ebdClasses?.length) ligadas += await syncGrupoEbd(grupo);
  }
  return { removidos: antigos.length, aulasLigadas: ligadas };
};

module.exports = {
  ATIVIDADE_LABEL,
  candidatesByCriteria,
  revisarCriterios,
  aplicarRevisao,
  syncMembers,
  sortedMembers,
  findEncontro,
  findOrCreateEncontro,
  gruposDoLider,
  tenantCongregacoes,
  EBD_PADRAO,
  syncAulaToEncontro,
  syncGrupoEbd,
  removeAulaEncontro,
  migrarEbdParaUnioes,
};
