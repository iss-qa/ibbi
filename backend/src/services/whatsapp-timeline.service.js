const Message = require('../models/Message.model');
const Person = require('../models/Person.model');
const Conversation = require('../models/Conversation.model');
const templates = require('../templates/messages.templates');
const { phoneVariants } = require('../utils/phone');
const { sanitizeNumber } = require('./whatsapp.service');

const TIPO_LABEL = {
  aniversario: 'Aniversário',
  aviso: 'Aviso',
  'reunião': 'Reunião',
  convite: 'Convite',
  documento: 'Documento',
  personalizada: 'Mensagem',
  'novo cadastro': 'Cadastro',
  'aviso - novo membro': 'Cadastro',
  novo_decidido: 'Boas-vindas',
  visitante: 'Boas-vindas',
  projeto_amigo: 'Projeto Amigo',
  ausencia: 'Sentimos sua falta',
  lideranca: 'Liderança',
  relatorio: 'Relatório',
  agente: 'Mensagem',
  oracao: 'Pedido de oração',
  assistente: 'Assistente',
  chamada: 'Chamada EBD',
};

const normName = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Famílias às vezes dividem o mesmo celular. Um envio pertence à pessoa quando o nome do
 * destinatário é o dela — ou quando o nome não é de nenhuma outra pessoa com esse número.
 */
const belongsTo = (destNome, person, outrosNomes) => {
  const n = normName(destNome);
  if (!n || n === normName(person.nome)) return true;
  return !outrosNomes.has(n);
};

const applyVariables = (text, person) => String(text || '')
  .replace(/\{nome\}/gi, person?.nome || '')
  .replace(/\{congregacao\}/gi, person?.congregacao || '');

/**
 * Linha do tempo do WhatsApp de uma pessoa: mensagens da igreja para o número dela,
 * pedidos de oração que ela enviou (userId) e conversas com o assistente.
 * incluirInternas: mostra avisos de liderança/relatório (quando a pessoa é líder).
 * Pedidos de oração DESTINADOS à caixa da igreja nunca entram (são de terceiros).
 */
const buildTimeline = async (person, { userId, incluirInternas = false } = {}) => {
  if (!person?.celular) return [];
  const variants = phoneVariants(person.celular);
  const ocultos = incluirInternas ? ['oracao'] : ['oracao', 'lideranca', 'relatorio'];

  const outros = await Person.find({ _id: { $ne: person._id }, celular: { $in: variants } }).select('nome').lean();
  const outrosNomes = new Set(outros.map((o) => normName(o.nome)));

  const [enviadas, pedidos, conversa] = await Promise.all([
    Message.find({ 'destinatarios.celular': { $in: variants }, tipo: { $nin: ocultos } }).sort({ criadoEm: -1 }).limit(300).lean(),
    userId ? Message.find({ tipo: 'oracao', enviadoPor: userId }).sort({ criadoEm: -1 }).limit(50).lean() : [],
    Conversation.findOne({ canal: 'whatsapp', chave: { $in: variants.map(sanitizeNumber) } }).lean(),
  ]);

  const itens = [];
  for (const m of enviadas) {
    const dest = (m.destinatarios || []).find((d) => variants.includes(String(d.celular)) && belongsTo(d.nome, person, outrosNomes));
    if (!dest) continue;
    const automatico = m.tipo === 'aniversario' && /^Envio automático/i.test(m.conteudo || '');
    itens.push({
      id: String(m._id),
      direcao: 'recebida',
      tipo: m.tipo,
      rotulo: TIPO_LABEL[m.tipo] || 'Mensagem',
      texto: automatico ? templates.aniversario(person.nome) : applyVariables(m.conteudo, person),
      anexo: m.tipo === 'aniversario' ? 'Cartão de aniversário' : null,
      status: dest.status || m.status,
      erro: dest.erro || m.erros?.find((e) => variants.includes(String(e.celular)))?.motivo || null,
      em: dest.processadoEm || m.concluidoEm || m.criadoEm,
    });
  }
  for (const p of pedidos) {
    itens.push({ id: `oracao-${p._id}`, direcao: 'enviada', tipo: 'oracao', rotulo: TIPO_LABEL.oracao, texto: p.conteudo, status: p.status, em: p.criadoEm });
  }
  (conversa?.history || []).forEach((t, i) => {
    itens.push({
      id: `conv-${i}`,
      direcao: t.role === 'user' ? 'enviada' : 'recebida',
      tipo: 'assistente',
      rotulo: t.role === 'user' ? null : TIPO_LABEL.assistente,
      texto: t.text,
      status: 'concluido',
      em: t.at,
    });
  });
  return itens.sort((a, b) => new Date(a.em) - new Date(b.em));
};

module.exports = { buildTimeline, TIPO_LABEL, normName };
