const Jornada = require('../models/Jornada.model');
const CareAlert = require('../models/CareAlert.model');
const Message = require('../models/Message.model');
const PedidoOracao = require('../models/PedidoOracao.model');
const Culto = require('../models/Culto.model');
const EbdAula = require('../models/EbdAula.model');
const Encontro = require('../models/Encontro.model');
const Escala = require('../models/Escala.model');
const Evento = require('../models/Evento.model');
const Person = require('../models/Person.model');
const { timezone } = require('../tenancy/brand');
const { zonedParts } = require('../utils/time');

/**
 * Painel de impacto do mês: o que o PastorIA fez pela igreja (prova de valor para a renovação).
 * Tudo vem de dados já registrados; "horas economizadas" é uma estimativa conservadora
 * (2 min por mensagem automática, 15 min por chamada registrada, 10 min por escala montada).
 */
const intervalo = (mes) => {
  const [y, m] = (mes || zonedParts(timezone()).isoDate.slice(0, 7)).split('-').map(Number);
  return { inicio: new Date(Date.UTC(y, m - 1, 1)), fim: new Date(Date.UTC(y, m, 1)), chave: `${y}-${String(m).padStart(2, '0')}` };
};
const mesAnterior = (chave) => {
  const [y, m] = chave.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const somaPresentes = (docs) => docs.reduce((a, d) => a + (d.presencas || []).filter((p) => p.presente !== false).length, 0);

const calcular = async (mes, filtro = {}) => {
  const { inicio, fim, chave } = intervalo(mes);
  const periodo = { $gte: inicio, $lt: fim };
  const [
    jornadasIniciadas, voltaram, recuperados, alertasComAcao, msgCuidado, msgAniversario, msgJornada,
    pedidos, pedidosOrados, cultos, aulas, encontros, escalas, eventos, novosCadastros,
  ] = await Promise.all([
    Jornada.countDocuments({ ...filtro, createdAt: periodo }),
    Jornada.countDocuments({ ...filtro, retornouEm: periodo }),
    CareAlert.countDocuments({ ...filtro, status: 'resolvido', resolvidoEm: periodo }),
    CareAlert.find({ ...filtro, 'acoes.em': periodo }).select('acoes').lean(),
    Message.countDocuments({ tipo: 'ausencia', status: 'concluido', criadoEm: periodo }),
    Message.countDocuments({ tipo: 'aniversario', status: 'concluido', criadoEm: periodo }),
    Message.countDocuments({ tipo: { $in: ['jornada', 'visitante', 'novo_decidido'] }, status: 'concluido', criadoEm: periodo }),
    PedidoOracao.countDocuments({ ...filtro, createdAt: periodo }),
    PedidoOracao.countDocuments({ ...filtro, status: 'orado', oradoEm: periodo }),
    Culto.find({ ...filtro, data: periodo }).select('presencas').lean(),
    EbdAula.find({ ...filtro, data: periodo }).select('presencas').lean(),
    Encontro.find({ ...filtro, data: periodo, ebdAulaId: null }).select('presencas').lean(),
    Escala.find({ ...filtro, data: periodo, cancelada: { $ne: true } }).select('itens.status').lean(),
    Evento.find({ ...filtro, createdAt: periodo }).select('inscricoes.status').lean(),
    Person.countDocuments({ ...filtro, createdAt: periodo }),
  ]);
  const acoes = alertasComAcao.flatMap((a) => a.acoes.filter((x) => x.em >= inicio && x.em < fim && !['mensagem_ia', 'lideranca_notificada'].includes(x.tipo)));
  const checkins = somaPresentes(cultos.map((c) => ({ presencas: c.presencas })));
  const presencas = somaPresentes(aulas) + somaPresentes(encontros) + checkins;
  const chamadas = aulas.length + encontros.length;
  const voluntarios = escalas.reduce((a, e) => a + e.itens.filter((i) => i.status === 'confirmado').length, 0);
  const inscricoes = eventos.reduce((a, e) => a + e.inscricoes.filter((i) => ['inscrito', 'pago'].includes(i.status)).length, 0);
  const mensagensAuto = msgCuidado + msgAniversario + msgJornada;
  return {
    mes: chave,
    visitantesAcompanhados: jornadasIniciadas,
    visitantesVoltaram: voltaram,
    ausentesRecuperados: recuperados,
    acoesCuidado: acoes.length,
    ligacoes: acoes.filter((a) => a.tipo === 'ligacao').length,
    visitas: acoes.filter((a) => a.tipo === 'visita').length,
    mensagensCuidado: msgCuidado,
    aniversariosFelicitados: msgAniversario,
    mensagensAcolhimento: msgJornada,
    pedidosOracao: pedidos,
    pedidosOrados,
    presencasRegistradas: presencas,
    checkinsCulto: checkins,
    chamadas,
    voluntariosConfirmados: voluntarios,
    inscricoesEventos: inscricoes,
    novosCadastros,
    horasEconomizadas: Math.round(((mensagensAuto * 2) + (chamadas * 15) + (escalas.length * 10)) / 60),
  };
};

const comComparativo = async (mes, filtro) => {
  const atual = await calcular(mes, filtro);
  const anterior = await calcular(mesAnterior(atual.mes), filtro);
  return { atual, anterior };
};

module.exports = { calcular, comComparativo, intervalo, mesAnterior };
