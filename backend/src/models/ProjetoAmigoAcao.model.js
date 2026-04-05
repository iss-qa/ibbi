const mongoose = require('mongoose');

const ProjetoAmigoAcaoSchema = new mongoose.Schema({
  referencia_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  referencia_tipo: {
    type: String,
    enum: ['novo_decidido', 'visitante'],
    required: true,
  },
  responsavel_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  tipo_acao: {
    type: String,
    enum: ['ligacao', 'visita', 'culto_agendado', 'acompanhamento', 'outros'],
    required: true,
  },
  descricao: { type: String, trim: true },
  data_agendada: { type: Date },
  data_realizada: { type: Date },
  status: {
    type: String,
    enum: ['pendente', 'realizado', 'cancelado'],
    default: 'pendente',
  },
  observacoes: { type: String, trim: true },
  grupo_triagem_id: { type: mongoose.Schema.Types.ObjectId, ref: 'TriagemGrupo' },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.models.ProjetoAmigoAcao || mongoose.model('ProjetoAmigoAcao', ProjetoAmigoAcaoSchema);
