const mongoose = require('mongoose');

const AtividadeSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  descricao: { type: String, trim: true },
  categoria: {
    type: String,
    enum: ['contato_inicial', 'visitacao', 'mensagem', 'integracao', 'acolhimento', 'acompanhamento', 'outro'],
    default: 'outro',
  },
  responsavel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  responsavel_nome: { type: String },
  concluida: { type: Boolean, default: false },
  concluida_em: { type: Date },
  observacao: { type: String, trim: true, default: '' },
  prazo: { type: Date },
  ordem: { type: Number, default: 0 },
}, { _id: true, timestamps: false });

const TriagemGrupoSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  tipo: {
    type: String,
    enum: ['novos_decididos', 'visitantes', 'personalizado'],
    required: true,
  },
  etapa: {
    type: String,
    enum: ['triagem', 'acolhimento', 'integracao', 'estudo_biblico', 'consolidacao', 'membro_pleno'],
    default: 'triagem',
  },
  descricao: { type: String, trim: true },
  membros: [
    {
      membro_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
      nome: { type: String },
      celular: { type: String },
      whatsapp: { type: String },
      cargo: { type: String },
      ativo: { type: Boolean, default: true },
    },
  ],
  acompanhados: [
    {
      person_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
      nome: { type: String },
      celular: { type: String },
      tipo: { type: String }, // 'novo decidido' ou 'visitante'
      data: { type: Date }, // dataDecisao ou dataVisita
      congregacao: { type: String },
      adicionado_em: { type: Date, default: Date.now },
    },
  ],
  atividades: [AtividadeSchema],
  ativo: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  congregacao: { type: String },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.models.TriagemGrupo || mongoose.model('TriagemGrupo', TriagemGrupoSchema);
