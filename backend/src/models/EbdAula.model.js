const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

const PresencaSchema = new mongoose.Schema(
  {
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    nome: { type: String },
    presente: { type: Boolean, default: true },
    justificativa: { type: String },
    motivo: { type: String, trim: true, maxlength: 200 }, // texto livre quando a justificativa é "outros"
  },
  { _id: false }
);

const EbdAulaSchema = new mongoose.Schema(
  {
    data: { type: Date, required: true },
    tema: { type: String },
    descricao: { type: String },
    professor: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    classe: {
      type: String,
      enum: ['Crianças', 'Adolescentes', 'Jovens', 'Adultos 1', 'Adultos 2', 'Idosos', 'Anciãos'],
      required: true,
    },
    congregacao: { type: String, required: true },
    presencas: [PresencaSchema],
    fotoUrl: { type: String }, // foto da turma enviada pelo líder (data URL)
    resumo: { type: String, trim: true }, // resumo da lição (usado nas mensagens aos ausentes)
    origem: { type: String, enum: ['web', 'whatsapp', 'assistente'], default: 'web' },
    ausenciasProcessadasEm: { type: Date },
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

EbdAulaSchema.index({ tenantId: 1, data: 1, classe: 1, congregacao: 1 }, { unique: true });
EbdAulaSchema.plugin(tenantPlugin);

// Cada aula com chamada também é registrada como Encontro (grupo "EBD — <classe>").
const mirror = (fn) => async function mirrorHook(doc) {
  if (!doc) return;
  try {
    const encontros = require('../services/encontro.service'); // lazy: evita dependência circular
    await fn(encontros, doc);
  } catch (err) {
    console.error('[EBD→Encontro] Falha ao espelhar aula:', err.message);
  }
};
EbdAulaSchema.post('save', mirror((svc, doc) => svc.syncAulaToEncontro(doc._id)));
EbdAulaSchema.post('findOneAndUpdate', mirror((svc, doc) => svc.syncAulaToEncontro(doc._id)));
EbdAulaSchema.post('findOneAndDelete', mirror((svc, doc) => svc.removeAulaEncontro(doc._id)));

EbdAulaSchema.virtual('totalPresentes').get(function totalPresentes() {
  return this.presencas.filter((p) => p.presente).length;
});

EbdAulaSchema.virtual('totalAusentes').get(function totalAusentes() {
  return this.presencas.filter((p) => !p.presente).length;
});

EbdAulaSchema.virtual('percentualPresenca').get(function percentualPresenca() {
  const total = this.presencas.length;
  if (!total) return 0;
  return Math.round((this.totalPresentes / total) * 100);
});

module.exports = mongoose.models.EbdAula || mongoose.model('EbdAula', EbdAulaSchema);
