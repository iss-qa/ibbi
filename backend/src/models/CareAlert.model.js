const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

const AcaoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['mensagem_ia', 'mensagem_manual', 'email', 'ligacao', 'visita', 'oracao', 'resposta_membro', 'lideranca_notificada', 'retorno', 'outro'],
    required: true,
  },
  canal: { type: String }, // whatsapp, email, presencial, telefone, sistema
  descricao: { type: String, trim: true },
  por: { type: String, trim: true }, // nome de quem fez (ou "Assistente IA")
  em: { type: Date, default: Date.now },
}, { _id: true });

// Alerta de cuidado pastoral: membro com faltas consecutivas na EBD.
const CareAlertSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  nome: { type: String, trim: true },
  celular: { type: String, trim: true },
  // Origem da frequência: EBD (classe) ou encontro de um grupo (união, louvor…)
  origem: { type: String, enum: ['ebd', 'encontro'], default: 'ebd' },
  grupoId: { type: mongoose.Schema.Types.ObjectId, ref: 'GrupoEncontro' },
  classe: { type: String }, // classe da EBD ou nome do grupo
  congregacao: { type: String },
  nivel: { type: String, enum: ['atencao', 'risco', 'critico'], default: 'atencao' },
  faltasConsecutivas: { type: Number, default: 0 },
  ultimaPresenca: { type: Date },
  status: {
    type: String,
    enum: ['aberto', 'em_contato', 'resolvido', 'ignorado'],
    default: 'aberto',
    index: true,
  },
  motivoInformado: { type: String, trim: true }, // resposta do membro interpretada pela IA
  precisaVisita: { type: Boolean, default: false },
  mensagemSugerida: { type: String }, // gerada pela IA, aguardando aprovação no painel
  mensagemEnviadaEm: { type: Date },
  liderancaNotificadaEm: { type: Date },
  resolvidoEm: { type: Date },
  acoes: [AcaoSchema],
}, { timestamps: true });

CareAlertSchema.index({ tenantId: 1, personId: 1, status: 1 });
CareAlertSchema.plugin(tenantPlugin);

module.exports = mongoose.models.CareAlert || mongoose.model('CareAlert', CareAlertSchema);
