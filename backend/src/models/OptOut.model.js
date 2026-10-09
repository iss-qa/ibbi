const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

// Descadastro do WhatsApp ("SAIR"). Enquanto `ativo`, NENHUMA mensagem sai para este número
// (bloqueio central em whatsapp.service). Só volta com "VOLTAR" da própria pessoa ou
// reativação registrada pela liderança com justificativa (consentimento da pessoa).
const HistoricoSchema = new mongoose.Schema({
  acao: { type: String, enum: ['saiu', 'voltou'], required: true },
  em: { type: Date, default: Date.now },
  origem: { type: String, enum: ['whatsapp', 'web', 'lider'], default: 'whatsapp' },
  por: { type: String, trim: true }, // quem registrou (reativação pela liderança)
  detalhe: { type: String, trim: true, maxlength: 300 }, // palavra enviada ou justificativa
}, { _id: false });

const OptOutSchema = new mongoose.Schema({
  chave: { type: String, required: true, trim: true }, // número local (DDD + número, sem 55)
  ativo: { type: Boolean, default: true, index: true },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  nome: { type: String, trim: true },
  desde: { type: Date, default: Date.now },
  historico: [HistoricoSchema],
}, { timestamps: true });

OptOutSchema.index({ tenantId: 1, chave: 1 }, { unique: true });
OptOutSchema.plugin(tenantPlugin);

module.exports = mongoose.models.OptOut || mongoose.model('OptOut', OptOutSchema);
