const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

// Idempotência das automações (ex.: "chamada:2026-09-27:Jovens:Sede" roda 1x).
const AutomationRunSchema = new mongoose.Schema({
  chave: { type: String, required: true },
  tipo: { type: String },
  resultado: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

AutomationRunSchema.index({ tenantId: 1, chave: 1 }, { unique: true });
AutomationRunSchema.plugin(tenantPlugin);

const Model = mongoose.models.AutomationRun || mongoose.model('AutomationRun', AutomationRunSchema);

// Reserva a chave atomicamente. Retorna true se esta execução "ganhou" a vez.
Model.claim = async (chave, tipo) => {
  try {
    await Model.create({ chave, tipo });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }
};

Model.release = (chave) => Model.deleteOne({ chave });

module.exports = Model;
