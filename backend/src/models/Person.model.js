const mongoose = require('mongoose');

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
    acompanhadoTipo: { type: String, enum: ['membro', 'manual'] },
    acompanhadoPersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    acompanhadoNome: { type: String, trim: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

PersonSchema.virtual('idade').get(function idade() {
  if (!this.dataNascimento) return null;
  const hoje = new Date();
  const ano = hoje.getFullYear() - this.dataNascimento.getFullYear();
  const aniversarioEsteAno = new Date(hoje.getFullYear(), this.dataNascimento.getMonth(), this.dataNascimento.getDate());
  return hoje < aniversarioEsteAno ? ano - 1 : ano;
});

PersonSchema.pre('save', function enforceBusinessRules(next) {
  if (this.batizado) {
    this.tipo = 'membro';
  }
  if (this.status === 'inativo' && !this.motivoInativacao) {
    return next(new Error('motivoInativacao é obrigatório quando status = inativo'));
  }
  return next();
});

module.exports = mongoose.model('Person', PersonSchema);
module.exports.CONGREGACOES = CONGREGACOES;
