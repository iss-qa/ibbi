const mongoose = require('mongoose');
const tenantPlugin = require('../tenancy/plugin');

// Pedido de oração (portal ou WhatsApp). A liderança lê a lista (web ou WhatsApp) e marca como orado.
const PedidoOracaoSchema = new mongoose.Schema({
  nome: { type: String, trim: true, required: true },
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  celular: { type: String, trim: true },
  congregacao: { type: String, trim: true },
  texto: { type: String, trim: true, required: true, maxlength: 3000 },
  origem: { type: String, enum: ['web', 'whatsapp', 'importado'], default: 'web' },
  status: { type: String, enum: ['novo', 'orado', 'arquivado'], default: 'novo', index: true },
  oradoEm: { type: Date },
  oradoPor: { type: String, trim: true },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }, // log do envio ao WhatsApp da igreja
}, { timestamps: true });

PedidoOracaoSchema.index({ tenantId: 1, createdAt: -1 });
PedidoOracaoSchema.index({ tenantId: 1, messageId: 1 }, { unique: true, partialFilterExpression: { messageId: { $type: 'objectId' } } });
PedidoOracaoSchema.plugin(tenantPlugin);

module.exports = mongoose.models.PedidoOracao || mongoose.model('PedidoOracao', PedidoOracaoSchema);
