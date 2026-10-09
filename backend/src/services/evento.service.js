const crypto = require('crypto');
const QRCode = require('qrcode');
const Evento = require('../models/Evento.model');
const Person = require('../models/Person.model');
const { pixCopiaECola } = require('../utils/pix');
const { phoneVariants, toLocal } = require('../utils/phone');
const { normalizeName } = require('../utils/person-rules');
const { getTenant } = require('../tenancy/context');
const { formatBr } = require('../utils/time');

/**
 * Eventos com inscrição pelo WhatsApp (sem IA, todos os planos):
 *  "INSCREVER <código>" → conhecido: inscreve (ou lista de espera se lotou); desconhecido: pede o nome.
 *  Evento pago: responde com Pix copia-e-cola (valor + identificador) e QR Code; a liderança confirma.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INSCREVER_RE = /^\s*inscrever\s*#?\s*([a-z0-9]{4,8})\b/i;
const gerarCodigo = () => Array.from(crypto.randomBytes(5), (b) => ALFABETO[b % ALFABETO.length]).join('');
const ATIVOS = ['inscrito', 'pago'];

// Cidade do BR Code: a dos Dados da igreja (o campo do Pix antigo fica só como reserva).
const pixConfig = (tenant = getTenant()) => ({ ...(tenant?.pix || {}), cidade: tenant?.cidade || tenant?.pix?.cidade });
const pixPronto = (tenant = getTenant()) => Boolean(pixConfig(tenant).chave && pixConfig(tenant).nome && pixConfig(tenant).cidade);

const criar = async (dados, user) => {
  for (let i = 0; i < 5; i += 1) {
    try {
      return await Evento.create({ ...dados, codigo: gerarCodigo(), criadoPor: user?._id });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  throw new Error('Não foi possível gerar o código do evento');
};

const ocupadas = (e) => e.inscricoes.filter((i) => ATIVOS.includes(i.status)).length;
const vagasRestantes = (e) => (e.vagas ? Math.max(0, e.vagas - ocupadas(e)) : null);

const pixDaInscricao = async (e, insc) => {
  if (!e.valor || !pixPronto()) return null;
  const cfg = pixConfig();
  const copiaECola = pixCopiaECola({ chave: cfg.chave, nome: cfg.nome, cidade: cfg.cidade, valor: e.valor, txid: insc.txid || `${e.codigo}${String(insc._id).slice(-6)}`, descricao: e.titulo });
  const qr = await QRCode.toDataURL(copiaECola, { width: 600, margin: 2 });
  return { copiaECola, qr };
};

const inscrever = async (evento, { personId, nome, celular, origem = 'whatsapp' }) => {
  const ja = evento.inscricoes.find((i) => i.status !== 'cancelado' && ((personId && String(i.personId) === String(personId)) || (celular && phoneVariants(celular).includes(toLocal(i.celular || '')))));
  if (ja) return { inscricao: ja, nova: false };
  const lotado = evento.vagas && vagasRestantes(evento) === 0;
  evento.inscricoes.push({ personId, nome, celular: celular ? toLocal(celular) : undefined, origem, status: lotado ? 'espera' : 'inscrito' });
  const insc = evento.inscricoes[evento.inscricoes.length - 1];
  insc.txid = `${evento.codigo}${String(insc._id).slice(-6).toUpperCase()}`;
  await evento.save();
  return { inscricao: insc, nova: true };
};

const eventoAbertoPorCodigo = (codigo) => Evento.findOne({ codigo: String(codigo).toUpperCase(), cancelado: { $ne: true }, inscricoesAbertas: true, data: { $gte: new Date(Date.now() - 864e5) } });

/** WhatsApp: "INSCREVER ABC12". Retorna { status, evento, inscricao, pix } ou { status: 'precisaNome', eventoId } */
const inscreverPorWhatsApp = async ({ codigo, telefone, nome }) => {
  const e = await eventoAbertoPorCodigo(codigo);
  if (!e) return { status: 'invalido' };
  const person = await Person.findOne({ celular: { $in: phoneVariants(telefone) } }).lean();
  if (!person && !nome) return { status: 'precisaNome', eventoId: String(e._id), titulo: e.titulo };
  const nomeFinal = person?.nome || normalizeName(String(nome).trim());
  const r = await inscrever(e, { personId: person?._id, nome: nomeFinal, celular: telefone });
  const pix = r.inscricao.status === 'inscrito' ? await pixDaInscricao(e, r.inscricao) : null;
  return { status: r.nova ? r.inscricao.status : 'ja', evento: e, inscricao: r.inscricao, pix, nome: nomeFinal };
};

const resumo = (e) => ({
  id: String(e._id), titulo: e.titulo, data: formatBr(e.data), horario: e.horario, local: e.local, congregacao: e.congregacao,
  valor: e.valor, vagas: e.vagas, codigo: e.codigo, inscricoesAbertas: e.inscricoesAbertas,
  inscritos: ocupadas(e), pagos: e.inscricoes.filter((i) => i.status === 'pago').length,
  espera: e.inscricoes.filter((i) => i.status === 'espera').length, restantes: vagasRestantes(e),
});

// Cancelou alguém: o primeiro da lista de espera sobe (e recebe aviso, se tiver celular).
const promoverEspera = async (evento) => {
  if (!evento.vagas || vagasRestantes(evento) === 0) return null;
  const prox = evento.inscricoes.find((i) => i.status === 'espera');
  if (!prox) return null;
  prox.status = 'inscrito';
  await evento.save();
  return prox;
};

module.exports = {
  INSCREVER_RE, criar, inscrever, inscreverPorWhatsApp, pixDaInscricao, pixPronto, resumo, vagasRestantes, promoverEspera, eventoAbertoPorCodigo, ATIVOS,
};
