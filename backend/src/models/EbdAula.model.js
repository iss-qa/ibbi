const mongoose = require('mongoose');

const PresencaSchema = new mongoose.Schema(
  {
    personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    nome: { type: String },
    presente: { type: Boolean, default: true },
    justificativa: { type: String },
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
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

EbdAulaSchema.index({ data: 1, classe: 1 }, { unique: true });

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
