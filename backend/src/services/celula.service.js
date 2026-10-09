const GrupoEncontro = require('../models/GrupoEncontro.model');
const Encontro = require('../models/Encontro.model');

/**
 * Painel das células (GrupoEncontro tipo 'celula'): saúde de cada uma nas últimas 8 semanas.
 *  🟢 ativa · 🟡 sem encontro há 2–3 semanas · 🔴 parada (4+ semanas sem encontro)
 *  "pronta para multiplicar": 12+ membros e presença média ≥ 70% nos últimos encontros.
 */
const SEMANA = 7 * 864e5;

const painel = async (filtro = {}) => {
  const celulas = await GrupoEncontro.find({ ...filtro, ativo: true, tipo: 'celula' }).lean();
  const desde = new Date(Date.now() - 8 * SEMANA);
  const mes = new Date(Date.now() - 30 * 864e5);
  const encontros = await Encontro.find({ grupoId: { $in: celulas.map((c) => c._id) }, data: { $gte: desde } }).sort({ data: -1 }).lean();
  const linhas = celulas.map((c) => {
    const lista = encontros.filter((e) => String(e.grupoId) === String(c._id) && e.presencas.length);
    const pct = (e) => Math.round((e.presencas.filter((p) => p.presente).length / e.presencas.length) * 100);
    const recentes = lista.slice(0, 4);
    const media = recentes.length ? Math.round(recentes.reduce((a, e) => a + pct(e), 0) / recentes.length) : null;
    const ultimo = lista[0]?.data || null;
    const semanas = ultimo ? Math.floor((Date.now() - new Date(ultimo)) / SEMANA) : null;
    const doMes = lista.filter((e) => new Date(e.data) >= mes);
    return {
      id: String(c._id), nome: c.nome, congregacao: c.congregacao, lideres: (c.lideres || []).map((l) => l.nome),
      membros: (c.membros || []).length, encontros8s: lista.length, media, ultimo,
      visitantesMes: doMes.reduce((a, e) => a + (e.relatorio?.visitantes || 0), 0),
      decisoesMes: doMes.reduce((a, e) => a + (e.relatorio?.decisoes || 0), 0),
      saude: semanas === null || semanas >= 4 ? 'parada' : semanas >= 2 ? 'atencao' : 'ativa',
      multiplicar: (c.membros || []).length >= 12 && media !== null && media >= 70,
    };
  });
  return {
    celulas: linhas.sort((a, b) => ({ parada: 0, atencao: 1, ativa: 2 }[a.saude] - { parada: 0, atencao: 1, ativa: 2 }[b.saude])),
    totais: {
      celulas: linhas.length,
      ativas: linhas.filter((l) => l.saude === 'ativa').length,
      membros: linhas.reduce((a, l) => a + l.membros, 0),
      visitantesMes: linhas.reduce((a, l) => a + l.visitantesMes, 0),
      decisoesMes: linhas.reduce((a, l) => a + l.decisoesMes, 0),
      prontasMultiplicar: linhas.filter((l) => l.multiplicar).length,
    },
  };
};

module.exports = { painel };
