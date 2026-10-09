const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

// Envio em massa retomável (resumo do sermão, divulgação de evento, lembrete de culto, aviso geral).
// O motor (services/campanha.service.js) envia em lotes pela fila anti-ban; se bater o limite
// diário, pausa até o dia seguinte e continua de onde parou. Status por destinatário.
const DestinatarioSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  nome: { type: String, trim: true },
  celular: { type: String, trim: true },
  status: { type: String, enum: ['pendente', 'enviando', 'enviado', 'erro', 'bloqueado'], default: 'pendente' },
  em: { type: Date },
  erro: { type: String, trim: true },
}, { _id: false });

const CampanhaSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['sermao', 'evento', 'lembrete', 'aviso'], required: true },
  titulo: { type: String, trim: true, required: true, maxlength: 120 },
  texto: { type: String, required: true, maxlength: 4000 }, // {nome} = primeiro nome
  publico: {
    congregacao: { type: String, trim: true }, // vazio = todas (no escopo de quem criou)
    tipos: { type: [String], default: [] }, // membro, congregado… (vazio = todos)
    descricao: { type: String, trim: true },
  },
  destinatarios: [DestinatarioSchema],
  enviarApos: { type: Date, default: Date.now },
  status: { type: String, enum: ['agendada', 'enviando', 'pausada', 'concluida', 'cancelada'], default: 'agendada', index: true },
  pausadaAte: { type: Date },
  concluidaEm: { type: Date },
  eventoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evento' },
  criadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  criadoPorNome: { type: String, trim: true },
  avisarCelular: { type: String, trim: true }, // quem recebe o aviso de conclusão (líder)
}, { timestamps: true });

CampanhaSchema.index({ tenantId: 1, status: 1, enviarApos: 1 });
CampanhaSchema.plugin(tenantPlugin);

module.exports = mongoose.models.Campanha || mongoose.model('Campanha', CampanhaSchema);
