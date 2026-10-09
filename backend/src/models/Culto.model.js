const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

// Culto com presença por check-in: QR Code abre o WhatsApp com "CHEGUEI <codigo>".
// Check-in é voluntário: conta como presença (retorno do visitante, frequência positiva),
// mas a ausência no culto NÃO gera falta.
const PresencaSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  nome: { type: String, trim: true },
  via: { type: String, enum: ['qr', 'lider', 'web'], default: 'qr' },
  visitante: { type: Boolean, default: false }, // primeira vez (cadastrado no check-in)
  em: { type: Date, default: Date.now },
}, { _id: false });

const CultoSchema = new mongoose.Schema({
  titulo: { type: String, trim: true, default: 'Culto' },
  congregacao: { type: String, trim: true, required: true },
  data: { type: Date, required: true }, // dia do culto (12:00Z do dia local)
  codigo: { type: String, required: true, uppercase: true, trim: true }, // vai no QR
  aberto: { type: Boolean, default: true },
  presencas: [PresencaSchema],
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  criadoPorNome: { type: String, trim: true },
}, { timestamps: true });

CultoSchema.index({ tenantId: 1, codigo: 1 }, { unique: true });
CultoSchema.index({ tenantId: 1, congregacao: 1, data: -1 });
CultoSchema.plugin(tenantPlugin);

module.exports = mongoose.models.Culto || mongoose.model('Culto', CultoSchema);
