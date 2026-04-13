const ProjetoAmigoAcao = require('../models/ProjetoAmigoAcao.model');
const Person = require('../models/Person.model');
const TriagemGrupo = require('../models/TriagemGrupo.model');
const { applyScopedCongregacaoFilter } = require('../utils/access');

const listByReferencia = async (req, res) => {
  try {
    const { referencia_tipo, referencia_id } = req.params;

    const acoes = await ProjetoAmigoAcao.find({
      referencia_tipo,
      referencia_id,
    })
      .sort({ created_at: -1 })
      .populate('responsavel_id', 'nome celular')
      .populate('grupo_triagem_id', 'nome');

    return res.json(acoes);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.created_by = req.user._id;

    const acao = await ProjetoAmigoAcao.create(payload);
    return res.status(201).json(acao);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const update = async (req, res) => {
  try {
    const acao = await ProjetoAmigoAcao.findById(req.params.id);
    if (!acao) return res.status(404).json({ message: 'Ação não encontrada' });

    const payload = { ...req.body, updated_at: new Date() };

    const updated = await ProjetoAmigoAcao.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    return res.json(updated);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const acao = await ProjetoAmigoAcao.findByIdAndDelete(req.params.id);
    if (!acao) return res.status(404).json({ message: 'Ação não encontrada' });
    return res.json({ message: 'Ação removida' });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

const dashboard = async (req, res) => {
  try {
    const { mes, ano, congregacao } = req.query;
    const now = new Date();
    const month = mes ? parseInt(mes) - 1 : now.getMonth();
    const year = ano ? parseInt(ano) : now.getFullYear();

    const inicioMes = new Date(year, month, 1);
    const fimMes = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // User role: scoped to their groups only
    if (req.user.role === 'user') {
      const grupos = await TriagemGrupo.find({
        'membros.membro_id': req.user.personId,
        ativo: true,
      }).select('nome tipo etapa congregacao membros acompanhados atividades ativo').lean();

      const acompanhadoIds = grupos.flatMap((g) => (g.acompanhados || []).map((a) => a.person_id)).filter(Boolean);
      const acompanhados = acompanhadoIds.length > 0
        ? await Person.find({ _id: { $in: acompanhadoIds }, status: 'ativo' })
            .select('nome celular congregacao tipo dataVisita dataDecisao acompanhadoNome acompanhadoPersonId fotoUrl')
            .lean()
        : [];

      const visitantes = acompanhados.filter((p) => p.tipo === 'visitante');
      const decididos = acompanhados.filter((p) => p.tipo === 'novo decidido');

      const gruposResumo = grupos.map((g) => {
        const totalAtiv = g.atividades?.length || 0;
        const concluidas = g.atividades?.filter((a) => a.concluida).length || 0;
        return {
          _id: g._id, nome: g.nome, tipo: g.tipo, etapa: g.etapa || 'triagem', congregacao: g.congregacao,
          totalMembros: g.membros?.length || 0, totalAcompanhados: g.acompanhados?.length || 0,
          totalAtividades: totalAtiv, atividadesConcluidas: concluidas,
          progresso: totalAtiv > 0 ? Math.round((concluidas / totalAtiv) * 100) : 0,
        };
      });

      return res.json({
        mes: month + 1, ano: year,
        visitantesMes: visitantes.filter((p) => p.dataVisita && new Date(p.dataVisita) >= inicioMes && new Date(p.dataVisita) <= fimMes).length,
        decididosMes: decididos.filter((p) => p.dataDecisao && new Date(p.dataDecisao) >= inicioMes && new Date(p.dataDecisao) <= fimMes).length,
        emAcompanhamento: acompanhados.length,
        semAmigo: acompanhados.filter((p) => !p.acompanhadoPersonId).length,
        visitantes: visitantes.slice(0, 10),
        decididos: decididos.slice(0, 10),
        grupos: gruposResumo,
      });
    }

    let baseFilter = { status: 'ativo' };
    baseFilter = await applyScopedCongregacaoFilter(req.user, baseFilter, congregacao);

    // KPIs
    const [visitantesMes, decididosMes, todosVisitantes, todosDecididos] = await Promise.all([
      Person.countDocuments({ ...baseFilter, tipo: 'visitante', dataVisita: { $gte: inicioMes, $lte: fimMes } }),
      Person.countDocuments({ ...baseFilter, tipo: 'novo decidido', dataDecisao: { $gte: inicioMes, $lte: fimMes } }),
      Person.find({ ...baseFilter, tipo: 'visitante' }).select('nome celular congregacao dataVisita acompanhadoNome acompanhadoPersonId fotoUrl createdAt').sort({ dataVisita: -1 }).limit(50).lean(),
      Person.find({ ...baseFilter, tipo: 'novo decidido' }).select('nome celular congregacao dataDecisao acompanhadoNome acompanhadoPersonId fotoUrl createdAt').sort({ dataDecisao: -1 }).limit(50).lean(),
    ]);

    const semAmigo = [...todosVisitantes, ...todosDecididos].filter((p) => !p.acompanhadoPersonId);

    // Groups summary — ocultar defaults na visão "Todos"
    let grupoFilter = { ativo: true };
    grupoFilter = await applyScopedCongregacaoFilter(req.user, grupoFilter, congregacao);
    if (req.user.role === 'master' && (!congregacao || congregacao === 'Todos')) {
      grupoFilter.isDefault = { $ne: true };
    }
    const grupos = await TriagemGrupo.find(grupoFilter).select('nome tipo etapa congregacao membros acompanhados atividades ativo').lean();

    const gruposResumo = grupos.map((g) => {
      const totalAtiv = g.atividades?.length || 0;
      const concluidas = g.atividades?.filter((a) => a.concluida).length || 0;
      return {
        _id: g._id,
        nome: g.nome,
        tipo: g.tipo,
        etapa: g.etapa || 'triagem',
        congregacao: g.congregacao,
        totalMembros: g.membros?.length || 0,
        totalAcompanhados: g.acompanhados?.length || 0,
        totalAtividades: totalAtiv,
        atividadesConcluidas: concluidas,
        progresso: totalAtiv > 0 ? Math.round((concluidas / totalAtiv) * 100) : 0,
      };
    });

    res.json({
      mes: month + 1,
      ano: year,
      visitantesMes,
      decididosMes,
      emAcompanhamento: todosVisitantes.length + todosDecididos.length,
      semAmigo: semAmigo.length,
      visitantes: todosVisitantes.slice(0, 10),
      decididos: todosDecididos.slice(0, 10),
      grupos: gruposResumo,
    });
  } catch (err) {
    console.error('[PROJETO AMIGO DASHBOARD]', err);
    return res.status(err.status || 500).json({ message: err.message });
  }
};

module.exports = {
  listByReferencia,
  create,
  update,
  remove,
  dashboard,
};
