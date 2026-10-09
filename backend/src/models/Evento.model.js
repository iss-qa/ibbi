const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

// Evento com inscrição pelo WhatsApp ("INSCREVER <código>") e Pix estático com valor.
const InscricaoSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  nome: { type: String, trim: true, required: true },
  celular: { type: String, trim: true },
  status: { type: String, enum: ['inscrito', 'espera', 'pago', 'cancelado'], default: 'inscrito' },
  origem: { type: String, enum: ['whatsapp', 'web'], default: 'whatsapp' },
  em: { type: Date, default: Date.now },
  pagoEm: { type: Date },
  confirmadoPor: { type: String, trim: true },
  txid: { type: String, trim: true },
}, { _id: true });

const EventoSchema = new mongoose.Schema({
  titulo: { type: String, trim: true, required: true, maxlength: 100 },
  descricao: { type: String, trim: true, maxlength: 1500 },
  data: { type: Date, required: true },
  horario: { type: String, trim: true },
  local: { type: String, trim: true, maxlength: 150 },
  congregacao: { type: String, trim: true },
  vagas: { type: Number, min: 1 }, // vazio = ilimitado
  valor: { type: Number, min: 0, default: 0 }, // R$; 0 = gratuito
  // Quem recebe o pagamento: o Pix da igreja (Configurações → Igreja) ou um líder/departamento com a
  // própria chave. Os pagamentos são marcados um a um no painel (switch "Pago"), por enquanto pelo master/admin.
  recebedor: {
    tipo: { type: String, enum: ['igreja', 'lider'], default: 'igreja' },
    nome: { type: String, trim: true, maxlength: 60 },
    departamento: { type: String, trim: true, maxlength: 60 },
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    chaveTipo: { type: String, enum: ['cpf', 'cnpj', 'celular', 'email', 'aleatoria'] },
    chave: { type: String, trim: true, maxlength: 77 },
  },
  codigo: { type: String, required: true, uppercase: true, trim: true },
  inscricoesAbertas: { type: Boolean, default: true },
  inscricoes: [InscricaoSchema],
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelado: { type: Boolean, default: false },
}, { timestamps: true });

EventoSchema.index({ tenantId: 1, codigo: 1 }, { unique: true });
EventoSchema.index({ tenantId: 1, data: 1 });
EventoSchema.plugin(tenantPlugin);

module.exports = mongoose.models.Evento || mongoose.model('Evento', EventoSchema);
