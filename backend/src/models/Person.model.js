const mongoose = require('mongoose');
const { applyPersonBusinessRules, calculateAge } = require('../utils/person-rules');

const CONGREGACOES = [
  'Não atribuído',
  'Sede',
  'São Cristóvão',
  'Vida Nova',
  'PQ São Paulo 1',
  'PQ São Paulo 2',
  'Capelão',
  'Bairro da Paz',
  'Dona Lindu',
  'Portão',
  'Olindina-BA',
  'Crisópolis-BA',
  'São Felipe-BA',
  'São Sebastião do Passé - BA'
];

const PersonSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    sexo: { type: String, enum: ['Masculino', 'Feminino'] },
    dataNascimento: { type: Date },
    email: { type: String, trim: true, lowercase: true },
    celular: { type: String, trim: true },
    tipo: {
      type: String,
      enum: ['membro', 'congregado', 'visitante', 'novo decidido', 'criança'],
      default: 'congregado',
    },
    grupo: {
      type: String,
      enum: ['criança', 'adolescente', 'jovem', 'adulto 1', 'adulto 2', 'idoso', 'ancião'],
    },
    estadoCivil: {
      type: String,
      enum: ['solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'separado(a)', 'união estável'],
    },
    batizado: { type: Boolean, default: false },
    dataBatismo: { type: Date },
    congregacao: { type: String, enum: CONGREGACOES, default: 'Não atribuído' },
    status: { type: String, enum: ['ativo', 'inativo'], default: 'ativo' },
    motivoInativacao: {
      type: String,
      enum: ['falecimento', 'desvio doutrinário', 'mudança de endereço', 'desconhecido', 'outro'],
    },
    endereco: { type: String, trim: true },
    ministerio: { type: String, trim: true },
    fotoUrl: { type: String, trim: true },
    dataVisita: { type: Date },
    dataDecisao: { type: Date },
    acompanhadoTipo: { type: String, enum: ['membro', 'manual'] },
    acompanhadoPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    acompanhadoNome: { type: String, trim: true },
    matricula: { type: Number, unique: true, sparse: true },
    tipoSanguineo: { type: String, enum: ['A', 'B', 'AB', 'O'] },
    fatorRh: { type: String, enum: ['+', '-'] },
    alergias: { type: String, trim: true },
    contatoEmergenciaNome: { type: String, trim: true },
    contatoEmergenciaTel: { type: String, trim: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Indexes para performance
PersonSchema.index({ status: 1, congregacao: 1 });
PersonSchema.index({ createdAt: -1 });
PersonSchema.index({ status: 1, dataNascimento: 1 });
PersonSchema.index({ nome: 1 });

PersonSchema.virtual('idade').get(function idade() {
  return calculateAge(this.dataNascimento);
});

PersonSchema.pre('save', async function enforceBusinessRules(next) {
  applyPersonBusinessRules(this);
  if (this.status === 'inativo' && !this.motivoInativacao) {
    return next(new Error('motivoInativacao é obrigatório quando status = inativo'));
  }
  // Auto-generate matricula if missing
  if (!this.matricula) {
    const PersonModel = mongoose.model('Person');
    const last = await PersonModel.findOne({ matricula: { $exists: true } }).sort({ matricula: -1 }).select('matricula').lean();
    this.matricula = (last?.matricula || 0) + 1;
  }
  return next();
});

PersonSchema.pre('findOneAndUpdate', function enforceUpdateBusinessRules(next) {
  const update = this.getUpdate();
  if (!update || typeof update !== 'object') return next();

  const payload = update.$set || update;
  const requestedTipo = payload.tipo;
  const requestedBatizado = payload.batizado;
  const requestedDataBatismo = payload.dataBatismo;
  applyPersonBusinessRules(payload);

  const mustClearBaptismDate = requestedTipo === 'congregado'
    || requestedBatizado === false
    || requestedDataBatismo === '';

  if (mustClearBaptismDate) {
    delete payload.dataBatismo;
    update.$unset = { ...(update.$unset || {}), dataBatismo: 1 };
  }

  if (update.$set) {
    this.setUpdate({ ...update, $set: payload });
  } else {
    this.setUpdate({
      $set: payload,
      ...(update.$unset ? { $unset: update.$unset } : {}),
    });
  }

  return next();
});

module.exports = mongoose.models.Person || mongoose.model('Person', PersonSchema);
module.exports.CONGREGACOES = CONGREGACOES;
