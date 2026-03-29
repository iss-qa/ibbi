const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['aniversario', 'aviso', 'reunião', 'ata', 'documento', 'convite', 'oracao', 'personalizada', 'aviso - novo membro'],
    required: true,
  },
  destinatarios: [{ nome: String, celular: String }],
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
