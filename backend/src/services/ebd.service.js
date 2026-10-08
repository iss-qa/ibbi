const EbdAula = require('../models/EbdAula.model');
const Person = require('../models/Person.model');
const { aulaDateFromIso, dayRangeFromIso } = require('../utils/time');

const CLASSE_TO_GRUPO = {
  'Crianças': 'criança',
  'Adolescentes': 'adolescente',
  'Jovens': 'jovem',
  'Adultos 1': 'adulto 1',
  'Adultos 2': 'adulto 2',
  'Idosos': 'idoso',
  'Anciãos': 'ancião',
};
const GRUPO_TO_CLASSE = Object.fromEntries(Object.entries(CLASSE_TO_GRUPO).map(([c, g]) => [g, c]));
const CLASSES = Object.keys(CLASSE_TO_GRUPO);

const normalize = (s) => String(s || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// Aceita "jovens", "Jovem", "adultos 1"… e devolve o nome canônico da classe.
const resolveClasse = (input) => {
  if (!input) return null;
  const n = normalize(input);
  const direct = CLASSES.find((c) => normalize(c) === n);
  if (direct) return direct;
  const byGrupo = GRUPO_TO_CLASSE[Object.keys(GRUPO_TO_CLASSE).find((g) => normalize(g) === n)];
  if (byGrupo) return byGrupo;
  return CLASSES.find((c) => normalize(c).startsWith(n.slice(0, 5))) || null;
};

const getRoster = (classe, congregacao) => Person.find({
  grupo: CLASSE_TO_GRUPO[classe] || classe,
  status: 'ativo',
  congregacao,
}).select('nome celular email').sort({ nome: 1 }).lean();

const findAula = ({ isoDate, classe, congregacao }) => EbdAula.findOne({
  data: dayRangeFromIso(isoDate),
  classe,
  congregacao,
});

// Presença pré-populada com todos os ativos do grupo, presente = true (regra 13).
const findOrCreateAula = async ({ isoDate, classe, congregacao, userId, origem = 'web', tema }) => {
  const existing = await findAula({ isoDate, classe, congregacao });
  if (existing) return { aula: existing, criada: false };
  const data = aulaDateFromIso(isoDate);
  if (data.getDay() !== 0) throw new Error('A aula deve ser em um domingo');
  const pessoas = await getRoster(classe, congregacao);
  const aula = await EbdAula.create({
    data,
    classe,
    congregacao,
    tema,
    origem,
    registradoPor: userId,
    presencas: pessoas.map((p) => ({ personId: p._id, nome: p.nome, presente: true })),
  });
  return { aula, criada: true };
};

// Chamada bloqueada para edição após 7 dias — exceto master (regra 14).
const canEditAula = (aula, role) => {
  const limite = new Date(aula.data);
  limite.setDate(limite.getDate() + 7);
  return new Date() <= limite || role === 'master';
};

/**
 * Casa termos ditos pelo líder ("Pedro", "a Maria Clara", "3") com a lista da turma.
 * Números referem-se à posição na lista enviada (1-based).
 */
const matchNames = (termos, roster) => {
  const matched = new Map();
  const naoEncontrados = [];
  const ambiguos = [];
  const entries = roster.map((p, i) => ({ ...p, idx: i + 1, n: normalize(p.nome), parts: normalize(p.nome).split(' ') }));

  for (const raw of termos) {
    const termo = normalize(raw).replace(/^(o|a|os|as|irmao|irma)\s+/, '');
    if (!termo) continue;
    if (/^\d+$/.test(termo)) {
      const hit = entries.find((e) => e.idx === Number(termo));
      if (hit) matched.set(String(hit._id), hit);
      else naoEncontrados.push(raw);
      continue;
    }
    const tparts = termo.split(' ');
    let candidates = entries.filter((e) => e.n === termo);
    if (!candidates.length) candidates = entries.filter((e) => tparts.every((tp) => e.parts.includes(tp)));
    if (!candidates.length) candidates = entries.filter((e) => e.parts[0] === tparts[0]);
    if (!candidates.length) candidates = entries.filter((e) => e.n.includes(termo));

    if (candidates.length === 1) matched.set(String(candidates[0]._id), candidates[0]);
    else if (candidates.length > 1) ambiguos.push({ termo: raw, opcoes: candidates.map((c) => c.nome) });
    else naoEncontrados.push(raw);
  }
  return { encontrados: [...matched.values()], naoEncontrados, ambiguos };
};

module.exports = {
  CLASSE_TO_GRUPO,
  GRUPO_TO_CLASSE,
  CLASSES,
  normalize,
  resolveClasse,
  getRoster,
  findAula,
  findOrCreateAula,
  canEditAula,
  matchNames,
};
