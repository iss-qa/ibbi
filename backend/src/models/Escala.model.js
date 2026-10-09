const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

// Escala de voluntários (louvor, recepção, som…) para um evento. Cada função recebe convite
// no WhatsApp ("1 Confirmo / 2 Não posso"); recusa avisa o responsável com sugestões de substituto.
const ItemSchema = new mongoose.Schema({
  funcao: { type: String, trim: true, required: true }, // Vocal, Teclado, Portaria…
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  nome: { type: String, trim: true },
  celular: { type: String, trim: true },
  status: { type: String, enum: ['pendente', 'confirmado', 'recusado'], default: 'pendente' },
  conviteEnviadoEm: { type: Date },
  respondidoEm: { type: Date },
  motivoRecusa: { type: String, trim: true },
  lembreteEnviadoEm: { type: Date },
  substituiu: { type: String, trim: true }, // nome de quem recusou, quando é substituto
}, { _id: true });

const EscalaSchema = new mongoose.Schema({
  ministerio: { type: String, trim: true, required: true }, // Louvor, Recepção, Som…
  evento: { type: String, trim: true, default: 'Culto' },
  congregacao: { type: String, trim: true, required: true },
  data: { type: Date, required: true }, // dia (12:00Z do dia local)
  horario: { type: String, trim: true }, // HH:MM
  observacao: { type: String, trim: true, maxlength: 500 },
  itens: [ItemSchema],
  responsavelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' }, // recebe recusas no WhatsApp
  responsavelNome: { type: String, trim: true },
  responsavelCelular: { type: String, trim: true },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelada: { type: Boolean, default: false },
}, { timestamps: true });

EscalaSchema.index({ tenantId: 1, data: 1 });
EscalaSchema.index({ tenantId: 1, 'itens.personId': 1, data: 1 });
EscalaSchema.plugin(tenantPlugin);

module.exports = mongoose.models.Escala || mongoose.model('Escala', EscalaSchema);
