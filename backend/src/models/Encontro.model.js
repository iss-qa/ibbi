const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

const ATIVIDADES = ['aula_ebd', 'culto', 'ensaio', 'reuniao', 'estudo', 'oracao', 'evangelismo', 'visita', 'confraternizacao', 'outro'];

const PresencaSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  nome: { type: String },
  presente: { type: Boolean, default: true },
  justificativa: { type: String },
  motivo: { type: String, trim: true, maxlength: 200 }, // texto livre quando a justificativa é "outros"
}, { _id: false });

// Encontro de um grupo (ex.: culto da União Feminina na quarta) com a chamada.
const EncontroSchema = new mongoose.Schema({
  grupoId: { type: mongoose.Schema.Types.ObjectId, ref: 'GrupoEncontro', required: true },
  grupoNome: { type: String },
  congregacao: { type: String, required: true },
  data: { type: Date, required: true },
  atividade: { type: String, enum: ATIVIDADES, default: 'reuniao' },
  tema: { type: String, trim: true },
  descricao: { type: String, trim: true },
  presencas: [PresencaSchema],
  fotoUrl: { type: String },
  origem: { type: String, enum: ['web', 'whatsapp', 'assistente'], default: 'web' },
  registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ausenciasProcessadasEm: { type: Date },
  ebdAulaId: { type: mongoose.Schema.Types.ObjectId, ref: 'EbdAula' }, // espelho de uma aula da EBD
  // Relatório de célula (pequeno grupo): visitantes e decisões por Jesus no encontro.
  relatorio: {
    visitantes: { type: Number, min: 0 },
    decisoes: { type: Number, min: 0 },
    observacao: { type: String, trim: true, maxlength: 500 },
  },
  // Resumo do encontro (texto ou áudio do líder, organizado pela IA) enviado aos membros 1h depois.
  resumo: {
    texto: { type: String, trim: true, maxlength: 4000 },
    original: { type: String, trim: true, maxlength: 6000 }, // relato do líder (texto ou transcrição)
    autorNome: { type: String, trim: true },
    autorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['agendado', 'enviando', 'enviado', 'cancelado'] },
    enviarEm: { type: Date },
    enviadoEm: { type: Date },
    destinatarios: { type: Number },
  },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// Não é único: um grupo pode receber mais de uma aula da EBD no mesmo domingo (várias classes).
// Encontros próprios são deduplicados em findOrCreateEncontro.
EncontroSchema.index({ tenantId: 1, grupoId: 1, data: 1, atividade: 1 });
EncontroSchema.index({ tenantId: 1, grupoId: 1, ebdAulaId: 1 }, { unique: true, partialFilterExpression: { ebdAulaId: { $type: 'objectId' } } });
EncontroSchema.index({ 'resumo.status': 1, 'resumo.enviarEm': 1 }, { sparse: true });
EncontroSchema.virtual('totalPresentes').get(function totalPresentes() {
  return (this.presencas || []).filter((p) => p.presente).length;
});
EncontroSchema.plugin(tenantPlugin);

module.exports = mongoose.models.Encontro || mongoose.model('Encontro', EncontroSchema);
module.exports.ATIVIDADES = ATIVIDADES;
