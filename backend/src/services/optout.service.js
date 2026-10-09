const OptOut = require('../models/OptOut.model');
const Person = require('../models/Person.model');
const { getTenantId } = require('../tenancy/context');
const { phoneVariants, toLocal } = require('../utils/phone');

/**
 * Descadastro do WhatsApp ("SAIR") — regra de ouro: número descadastrado NÃO recebe nada
 * até reativar. O bloqueio fica em whatsapp.service (todas as funções de envio + fila).
 * Cache por igreja (60s) para não consultar o banco a cada mensagem; invalidado a cada mudança.
 */
const SAIR_RE = /^\s*(sair|parar|stop|descadastrar|descadastre|remover|cancelar inscri[cç][aã]o|sair da lista|n[aã]o quero (mais )?receber( mensagens)?)\s*[.!]*\s*$/i;
const VOLTAR_RE = /^\s*(voltar|reativar|quero voltar|quero receber|receber de novo|start)\s*[.!]*\s*$/i;

const TTL_MS = 60e3;
const cache = new Map(); // tenantId → { set, at }

const carregar = async (tenantId) => {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.set;
  const ativos = await OptOut.find({ ativo: true }).select('chave').lean();
  const set = new Set(ativos.flatMap((o) => phoneVariants(o.chave)));
  cache.set(tenantId, { set, at: Date.now() });
  return set;
};
const invalidar = (tenantId = getTenantId()) => cache.delete(String(tenantId));

// true = este número pediu para sair (não enviar). Grupos (JID) não entram na regra.
const bloqueado = async (numero) => {
  const tenantId = getTenantId();
  if (!tenantId || !numero || String(numero).includes('@')) return false;
  const set = await carregar(String(tenantId));
  return phoneVariants(numero).some((v) => set.has(v));
};

const pessoaDo = (numero) => Person.findOne({ celular: { $in: phoneVariants(numero) } }).select('nome').lean();

const sair = async (numero, { origem = 'whatsapp', detalhe, por } = {}) => {
  const chave = toLocal(numero);
  const pessoa = await pessoaDo(numero);
  const doc = await OptOut.findOneAndUpdate(
    { chave },
    {
      $set: { ativo: true, desde: new Date(), personId: pessoa?._id, nome: pessoa?.nome },
      $push: { historico: { acao: 'saiu', origem, detalhe: detalhe ? String(detalhe).slice(0, 300) : undefined, por } },
    },
    { upsert: true, new: true },
  ).lean();
  invalidar();
  // Jornada e convites pendentes param: nada programado sai para quem pediu para sair.
  if (pessoa) {
    await require('../models/Jornada.model').updateMany({ personId: pessoa._id, status: 'ativa' }, { $set: { status: 'cancelada', canceladaMotivo: 'pediu para sair (SAIR)' } }).catch(() => {});
  }
  return doc;
};

const voltar = async (numero, { origem = 'whatsapp', detalhe, por } = {}) => {
  const chave = toLocal(numero);
  const doc = await OptOut.findOneAndUpdate(
    { chave: { $in: phoneVariants(numero).map(toLocal) }, ativo: true },
    { $set: { ativo: false }, $push: { historico: { acao: 'voltou', origem, detalhe: detalhe ? String(detalhe).slice(0, 300) : undefined, por } } },
    { new: true },
  ).lean();
  invalidar();
  return doc || (await OptOut.findOne({ chave }).lean());
};

const statusDe = async (numero) => (numero ? OptOut.findOne({ chave: { $in: phoneVariants(numero).map(toLocal) } }).lean() : null);

module.exports = { SAIR_RE, VOLTAR_RE, bloqueado, sair, voltar, statusDe, invalidar };
