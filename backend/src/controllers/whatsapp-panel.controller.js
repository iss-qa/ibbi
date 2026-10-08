const { ASSISTENTE_PADRAO } = require('../config/assistentes');
const Person = require('../models/Person.model');
const Message = require('../models/Message.model');
const Conversation = require('../models/Conversation.model');
const { buildTimeline, TIPO_LABEL, normName } = require('../services/whatsapp-timeline.service');
const { sanitizeNumber } = require('../services/whatsapp.service');
const { applyScopedCongregacaoFilter, assertPersonAccess } = require('../utils/access');
const { phoneVariants } = require('../utils/phone');
const { escapeRegex } = require('../utils/sanitize');
const { igreja } = require('./me.controller');
const { getTenant } = require('../tenancy/context');

const DAYS = 180;

// Lista de "conversas": pessoas das congregações do usuário com mensagens da igreja.
const contacts = async (req, res) => {
  const { search, congregacao } = req.query;
  const base = { celular: { $nin: [null, ''] } };
  if (search) base.nome = new RegExp(escapeRegex(String(search)), 'i');
  const filter = await applyScopedCongregacaoFilter(req.user, base, congregacao);
  const persons = await Person.find(filter).select('nome celular congregacao fotoUrl tipo').lean();

  // Número → pessoas (famílias podem dividir o mesmo celular)
  const byVariant = new Map();
  persons.forEach((p) => phoneVariants(p.celular).forEach((v) => byVariant.set(v, [...(byVariant.get(v) || []), p])));
  const pick = (celular, nome) => {
    const lista = byVariant.get(String(celular)) || byVariant.get(String(celular).replace(/^55/, '')) || [];
    return lista.find((p) => normName(p.nome) === normName(nome)) || (lista.length === 1 ? lista[0] : lista[0]);
  };
  const variants = [...byVariant.keys()];

  const [rows, conversas] = await Promise.all([
    Message.aggregate([
      { $match: { tipo: { $ne: 'oracao' }, criadoEm: { $gte: new Date(Date.now() - DAYS * 864e5) } } },
      { $unwind: '$destinatarios' },
      { $match: { 'destinatarios.celular': { $in: variants } } },
      { $sort: { criadoEm: -1 } },
      {
        $group: {
          _id: { celular: '$destinatarios.celular', nome: '$destinatarios.nome' },
          ultima: { $first: '$criadoEm' },
          tipo: { $first: '$tipo' },
          conteudo: { $first: '$conteudo' },
          status: { $first: '$destinatarios.status' },
          total: { $sum: 1 },
          erros: { $sum: { $cond: [{ $eq: ['$destinatarios.status', 'erro'] }, 1, 0] } },
        },
      },
    ]),
    Conversation.find({ canal: 'whatsapp', chave: { $in: variants.map(sanitizeNumber) } }).select('chave nome updatedAt history').lean(),
  ]);

  const acc = new Map(); // personId → resumo
  const touch = (person, patch) => {
    const id = String(person._id);
    const cur = acc.get(id) || { personId: id, nome: person.nome, celular: person.celular, congregacao: person.congregacao, fotoUrl: person.fotoUrl, tipo: person.tipo, total: 0, erros: 0, ultima: null };
    cur.total += patch.total || 0;
    cur.erros += patch.erros || 0;
    if (patch.ultima && (!cur.ultima || new Date(patch.ultima) > new Date(cur.ultima))) {
      cur.ultima = patch.ultima;
      cur.preview = patch.preview;
      cur.ultimoTipo = patch.tipo;
      cur.ultimoStatus = patch.status;
    }
    acc.set(id, cur);
  };
  rows.forEach((r) => {
    const person = pick(r._id.celular, r._id.nome);
    if (!person) return;
    const preview = r.tipo === 'aniversario' && /^Envio automático/i.test(r.conteudo || '') ? '🎂 Feliz aniversário!' : String(r.conteudo || '').replace(/[*_]/g, '').slice(0, 90);
    touch(person, { total: r.total, erros: r.erros, ultima: r.ultima, preview, tipo: TIPO_LABEL[r.tipo] || 'Mensagem', status: r.status });
  });
  conversas.forEach((c) => {
    const person = pick(c.chave, c.nome);
    const last = c.history?.[c.history.length - 1];
    if (!person || !last) return;
    touch(person, { total: c.history.length, ultima: last.at || c.updatedAt, preview: String(last.text || '').slice(0, 90), tipo: 'Assistente', status: 'concluido' });
  });

  let lista = [...acc.values()].sort((a, b) => new Date(b.ultima) - new Date(a.ultima));
  // Na busca, mostra também quem ainda não recebeu mensagens.
  if (search) {
    const ids = new Set(lista.map((l) => l.personId));
    persons.filter((p) => !ids.has(String(p._id))).slice(0, 30).forEach((p) => lista.push({
      personId: String(p._id), nome: p.nome, celular: p.celular, congregacao: p.congregacao, fotoUrl: p.fotoUrl, tipo: p.tipo, total: 0, erros: 0, ultima: null,
    }));
  }
  lista = lista.slice(0, 300);

  res.json({
    igreja: igreja(),
    periodoDias: DAYS,
    totais: {
      conversas: acc.size,
      mensagens: [...acc.values()].reduce((s, c) => s + c.total, 0),
      erros: [...acc.values()].reduce((s, c) => s + c.erros, 0),
    },
    contatos: lista,
  });
};

const thread = async (req, res) => {
  const person = await Person.findById(req.params.id).select('nome celular congregacao fotoUrl tipo').lean();
  if (!person) return res.status(404).json({ message: 'Pessoa não encontrada' });
  await assertPersonAccess(req.user, person);
  const itens = await buildTimeline(person, { incluirInternas: true });
  return res.json({ pessoa: person, igreja: igreja(), assistente: getTenant()?.ia?.nomeAssistente || ASSISTENTE_PADRAO, itens });
};

module.exports = { contacts, thread };
