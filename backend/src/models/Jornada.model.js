const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

// Jornada de 30 dias de um visitante ou novo decidido: mensagens programadas de acolhimento
// até a pessoa se firmar na igreja. A presença (EBD, encontro ou culto) marca o retorno.
const EtapaSchema = new mongoose.Schema({
  chave: { type: String, required: true }, // ex.: d3_como_foi (ver services/jornada.service.js)
  dia: { type: Number, required: true }, // dias desde o início
  status: { type: String, enum: ['pendente', 'enviada', 'pulada', 'erro'], default: 'pendente' },
  enviadaEm: { type: Date },
  erro: { type: String },
}, { _id: false });

const JornadaSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  nome: { type: String, trim: true },
  celular: { type: String, trim: true },
  congregacao: { type: String, trim: true },
  tipo: { type: String, enum: ['visitante', 'novo decidido'], required: true },
  inicio: { type: Date, required: true },
  etapas: [EtapaSchema],
  status: { type: String, enum: ['ativa', 'concluida', 'cancelada'], default: 'ativa', index: true },
  retornou: { type: Boolean, default: false },
  retornouEm: { type: Date },
  retornouOnde: { type: String, trim: true }, // "EBD Jovens", "Culto 12/10"…
  respondeuEm: { type: Date }, // última vez que a pessoa respondeu no WhatsApp
  liderancaAvisadaEm: { type: Date },
  canceladaMotivo: { type: String, trim: true },
}, { timestamps: true });

JornadaSchema.index({ tenantId: 1, personId: 1 }, { unique: true });
JornadaSchema.index({ tenantId: 1, status: 1, inicio: 1 });
JornadaSchema.plugin(tenantPlugin);

module.exports = mongoose.models.Jornada || mongoose.model('Jornada', JornadaSchema);
