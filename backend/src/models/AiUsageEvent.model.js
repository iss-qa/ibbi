const mongoose = require('mongoose');

// Uma linha por chamada de IA (nível plataforma — não usa tenantPlugin): quem, qual provedor e
// modelo (o servido de fato, com versão), tokens e custo gravado no momento com a cotação do dia.
// Some sozinho após 400 dias (os totais mensais ficam em UsageCounter).
const AiUsageEventSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  at: { type: Date, default: Date.now },
  provider: { type: String }, // anthropic | gemini | openai | groq
  model: { type: String }, // modelo pedido (AI_MODEL / GEMINI_MODEL / TRANSCRIPTION_MODEL)
  modelVersion: { type: String }, // modelo/versão que respondeu (response.model / modelVersion)
  operacao: { type: String }, // agente | texto | transcricao
  interacao: { type: Boolean, default: false }, // conta no limite de interações do plano
  inputTokens: { type: Number, default: 0 }, // total de entrada (inclui cache)
  cachedTokens: { type: Number, default: 0 },
  cacheWriteTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 }, // inclui "pensamento"
  thinkingTokens: { type: Number, default: 0 },
  audioSegundos: { type: Number, default: 0 },
  custoUsd: { type: Number, default: 0 },
  usdBrl: { type: Number },
  custoBrl: { type: Number, default: 0 },
  ms: { type: Number }, // latência
}, { versionKey: false });

AiUsageEventSchema.index({ tenantId: 1, at: -1 });
AiUsageEventSchema.index({ at: 1 }, { expireAfterSeconds: 400 * 24 * 3600 });

module.exports = mongoose.models.AiUsageEvent || mongoose.model('AiUsageEvent', AiUsageEventSchema);
