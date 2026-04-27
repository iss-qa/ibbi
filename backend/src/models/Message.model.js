const mongoose = require('mongoose');

const DestinatarioSchema = new mongoose.Schema({
  nome: { type: String },
  celular: { type: String },
  status: { type: String, enum: ['pendente', 'enviando', 'concluido', 'erro'], default: 'pendente' },
  ordem: { type: Number },
  processadoEm: { type: Date },
  erro: { type: String },
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['aniversario', 'aviso', 'reunião', 'ata', 'documento', 'convite', 'oracao', 'personalizada', 'aviso - novo membro', 'novo cadastro', 'projeto_amigo', 'novo_decidido', 'visitante'],
    required: true,
  },
  destinatarios: [DestinatarioSchema],
  conteudo: { type: String, required: true },
  status: { type: String, enum: ['pendente', 'enviando', 'concluido', 'erro'], default: 'pendente' },
  enviadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  origemNome: { type: String },
  origemCongregacao: { type: String },
  criadoEm: { type: Date, default: Date.now },
  concluidoEm: { type: Date },
  erros: [{ celular: String, motivo: String }],
});

module.exports = mongoose.models.Message || mongoose.model('Message', MessageSchema);
