const crypto = require('crypto');
const QRCode = require('qrcode');
const Culto = require('../models/Culto.model');
const Person = require('../models/Person.model');
const { phoneVariants, toLocal } = require('../utils/phone');
const { normalizeName } = require('../utils/person-rules');
const { getTenant } = require('../tenancy/context');
const { timezone } = require('../tenancy/brand');
const { zonedParts, formatBr } = require('../utils/time');

/**
 * Presença no culto por check-in: o QR Code abre o WhatsApp da igreja com "CHEGUEI <código>".
 * - Número conhecido: presença marcada na hora.
 * - Número desconhecido: pede o nome, cadastra como visitante (boas-vindas + jornada de 30 dias).
 * O check-in é voluntário: conta como presença, mas não gera falta para quem não fez.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I
const CHECKIN_RE = /^\s*cheguei\s*#?\s*([a-z0-9]{4,8})\b/i;
const VALIDADE_MS = 30 * 3600e3; // código vale até ~30h depois da abertura

const gerarCodigo = () => Array.from(crypto.randomBytes(5), (b) => ALFABETO[b % ALFABETO.length]).join('');
const hojeIso = () => zonedParts(timezone()).isoDate;
const diaDoCulto = (iso) => new Date(`${iso}T12:00:00Z`);

// Número do WhatsApp da igreja (o robô), para o link do QR.
const numeroBot = (tenant = getTenant()) => String(tenant?.whatsapp?.numeroInstancia
  || (tenant?.whatsapp?.useEnvFallback ? process.env.WHATSAPP_NUMERO_INSTANCIA : '') || '').replace(/\D/g, '');

// Culto de hoje nesta congregação (reaproveita o aberto) ou um novo.
const abrirCulto = async ({ congregacao, titulo = 'Culto', userId, userNome }) => {
  const data = diaDoCulto(hojeIso());
  const existente = await Culto.findOne({ congregacao, data, aberto: true }).sort({ createdAt: -1 });
  if (existente) return { culto: existente, criado: false };
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    try {
      const culto = await Culto.create({ titulo, congregacao, data, codigo: gerarCodigo(), criadoPor: userId, criadoPorNome: userNome });
      return { culto, criado: true };
    } catch (err) {
      if (err.code !== 11000) throw err; // colisão de código: tenta outro
    }
  }
  throw new Error('Não foi possível gerar o código do culto. Tente de novo.');
};

const linkCheckin = (culto) => {
  const numero = numeroBot();
  if (!numero) {
    const err = new Error('Informe o número do WhatsApp da igreja em Configurações → WhatsApp (número da instância) para gerar o QR Code.');
    err.status = 400;
    err.toolError = true;
    throw err;
  }
  return `https://wa.me/${numero}?text=${encodeURIComponent(`CHEGUEI ${culto.codigo}`)}`;
};

const qrDataUrl = async (culto, width = 900) => QRCode.toDataURL(linkCheckin(culto), { width, margin: 2, errorCorrectionLevel: 'M' });

const encerrar = async (cultoId) => Culto.findOneAndUpdate({ _id: cultoId }, { $set: { aberto: false } }, { new: true }).lean();

const cultoPorCodigo = (codigo) => Culto.findOne({
  codigo: String(codigo).toUpperCase(), aberto: true, createdAt: { $gte: new Date(Date.now() - VALIDADE_MS) },
});

const registrarPresenca = async (culto, person, { via = 'qr', visitante = false } = {}) => {
  if (culto.presencas.some((p) => String(p.personId) === String(person._id))) return false;
  // Atômico: QR e recepção (web) marcando a mesma pessoa ao mesmo tempo não duplicam a presença
  const presenca = { personId: person._id, nome: person.nome, via, visitante, em: new Date() };
  const r = await Culto.updateOne(
    { _id: culto._id, 'presencas.personId': { $ne: person._id } },
    { $push: { presencas: presenca } },
  );
  if (!r.modifiedCount) return false;
  culto.presencas.push(presenca);
  // Retorno do visitante/novo decidido (jornada) — import tardio evita ciclo de módulos.
  await require('./jornada.service').marcarRetorno(person._id, `${culto.titulo} ${formatBr(culto.data)}`).catch(() => {});
  return true;
};

/**
 * "CHEGUEI ABC12" vindo do WhatsApp. Retorna:
 *   { status: 'invalido' } | { status: 'ok'|'repetido', nome, titulo } | { status: 'precisaNome', cultoId }
 */
const checkin = async ({ codigo, telefone }) => {
  const culto = await cultoPorCodigo(codigo);
  if (!culto) return { status: 'invalido' };
  const person = await Person.findOne({ celular: { $in: phoneVariants(telefone) } }).sort({ status: 1 }).lean();
  if (!person) return { status: 'precisaNome', cultoId: String(culto._id), titulo: culto.titulo };
  const novo = await registrarPresenca(culto, person);
  return { status: novo ? 'ok' : 'repetido', nome: person.nome, titulo: culto.titulo };
};

// Visitante que fez check-in sem cadastro: cria a pessoa (dispara boas-vindas + jornada) e marca presença.
const checkinVisitante = async ({ cultoId, nome, telefone }) => {
  const culto = await Culto.findOne({ _id: cultoId, aberto: true });
  if (!culto) return { status: 'invalido' };
  const nomeLimpo = normalizeName(String(nome || '').replace(/[^\p{L}\s'.-]/gu, ' ').replace(/\s+/g, ' ').trim());
  if (nomeLimpo.split(' ').filter((p) => p.length > 1).length < 2) return { status: 'nomeIncompleto' };
  let person = await Person.findOne({ celular: { $in: phoneVariants(telefone) } }).lean();
  let criado = false;
  if (!person) {
    person = await Person.create({
      nome: nomeLimpo, tipo: 'visitante', celular: toLocal(telefone), congregacao: culto.congregacao, dataVisita: new Date(), status: 'ativo',
    });
    criado = true;
    require('./trigger.service').triggerVisitanteWhatsApp(person, null);
  }
  await registrarPresenca(culto, person, { visitante: criado });
  return { status: 'ok', nome: person.nome, criado };
};

const resumo = (c) => ({
  id: String(c._id), titulo: c.titulo, congregacao: c.congregacao, data: formatBr(c.data), codigo: c.codigo, aberto: c.aberto,
  presentes: c.presencas.length, visitantes: c.presencas.filter((p) => p.visitante).length,
});

module.exports = {
  CHECKIN_RE, abrirCulto, qrDataUrl, linkCheckin, encerrar, checkin, checkinVisitante, registrarPresenca, numeroBot, resumo, hojeIso,
};
