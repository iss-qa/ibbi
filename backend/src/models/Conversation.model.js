const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

const TurnSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  text: { type: String, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });

// Conversa do agente de IA (WhatsApp ou chat web). Guardamos só o texto dos turnos;
// o estado estruturado (chamada em andamento, aprovações pendentes) fica em `state`.
const ConversationSchema = new mongoose.Schema({
  canal: { type: String, enum: ['whatsapp', 'web'], required: true },
  chave: { type: String, required: true }, // telefone (whatsapp) ou userId (web)
  papel: { type: String, enum: ['lider', 'membro', 'desconhecido'], default: 'desconhecido' },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nome: { type: String, trim: true },
  history: { type: [TurnSchema], default: [] },
  state: { type: mongoose.Schema.Types.Mixed, default: null },
  lastInboundAt: { type: Date }, // janela de 24h da API oficial
  lastMediaDataUrl: { type: String }, // última imagem recebida (ex.: foto da aula)
}, { timestamps: true, minimize: false });

ConversationSchema.index({ tenantId: 1, canal: 1, chave: 1 }, { unique: true });
ConversationSchema.plugin(tenantPlugin);

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema);
