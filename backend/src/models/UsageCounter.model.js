const mongoose = require('mongoose');

// Consumo mensal por tenant (nível plataforma — lido pelo painel e pelos limites do plano).
const UsageCounterSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  periodo: { type: String, required: true }, // YYYY-MM
  whatsappEnviadas: { type: Number, default: 0 },
  whatsappErros: { type: Number, default: 0 },
  whatsappRecebidas: { type: Number, default: 0 },
  emailsEnviados: { type: Number, default: 0 },
  iaInteracoes: { type: Number, default: 0 },
  iaInputTokens: { type: Number, default: 0 },
  iaOutputTokens: { type: Number, default: 0 },
  iaCachedTokens: { type: Number, default: 0 }, // parte da entrada lida do cache (mais barata)
  iaCustoUsd: { type: Number, default: 0 }, // custo gravado no momento da chamada (config/ai-pricing.js)
}, { timestamps: true });

UsageCounterSchema.index({ tenantId: 1, periodo: 1 }, { unique: true });

module.exports = mongoose.models.UsageCounter || mongoose.model('UsageCounter', UsageCounterSchema);
