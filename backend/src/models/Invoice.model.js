const mongoose = require('mongoose');

// Fatura da assinatura (nível plataforma — não usa tenantPlugin).
const InvoiceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  competencia: { type: String, required: true }, // YYYY-MM
  descricao: { type: String, trim: true },
  plano: { type: String },
  ciclo: { type: String, enum: ['mensal', 'anual'], default: 'mensal' },
  valor: { type: Number, required: true, min: 0 },
  desconto: { type: Number, default: 0 },
  vencimento: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pendente', 'pago', 'vencido', 'cancelado'],
    default: 'pendente',
    index: true,
  },
  pagoEm: { type: Date },
  valorPago: { type: Number },
  metodo: { type: String, enum: ['pix', 'boleto', 'cartao', 'transferencia', 'dinheiro', 'outro', 'credito'] }, // credito = mês grátis por indicação
  observacao: { type: String, trim: true },
  gateway: {
    provider: { type: String },
    id: { type: String, index: true, sparse: true },
    invoiceUrl: { type: String },
    status: { type: String },
  },
  lembretesEnviados: { type: Number, default: 0 },
}, { timestamps: true });

InvoiceSchema.index({ tenantId: 1, competencia: 1 }, { unique: true });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
