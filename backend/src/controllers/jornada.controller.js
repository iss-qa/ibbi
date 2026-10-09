const Jornada = require('../models/Jornada.model');
const jornadaSvc = require('../services/jornada.service');
const { applyScopedCongregacaoFilter } = require('../utils/access');
const { hasFeature } = require('../config/plans');

const list = async (req, res) => {
  if (!hasFeature(req.tenant, 'jornadaVisitante')) return res.status(403).json({ message: 'Jornada do visitante disponível a partir do plano Crescer.' });
  const filtro = await applyScopedCongregacaoFilter(req.user, {}, req.query.congregacao);
  const jornadas = await jornadaSvc.listarJornadas({ filtro, incluirConcluidas: true });
  const ativas = jornadas.filter((j) => j.status === 'ativa');
  return res.json({
    jornadas,
    totais: {
      ativas: ativas.length,
      retornaram: jornadas.filter((j) => j.retornou).length,
      concluidas: jornadas.filter((j) => j.status === 'concluida').length,
      taxaRetorno: jornadas.length ? Math.round((jornadas.filter((j) => j.retornou).length / jornadas.length) * 100) : 0,
    },
  });
};

const cancelar = async (req, res) => {
  const filtro = await applyScopedCongregacaoFilter(req.user, { _id: req.params.id });
  const j = await Jornada.findOneAndUpdate(filtro, { $set: { status: 'cancelada', canceladaMotivo: String(req.body?.motivo || 'encerrada pela liderança').slice(0, 120) } }, { new: true }).lean();
  if (!j) return res.status(404).json({ message: 'Jornada não encontrada' });
  return res.json(j);
};

module.exports = { list, cancelar };
